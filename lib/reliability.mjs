const encoder=new TextEncoder();
const bytes=x=>encoder.encode(JSON.stringify(x)).length;
export const CHAT_BUDGET=3_500_000;
export const MAX_ANSWER=750_000;
export function boundedMessages(messages,budget=CHAT_BUDGET){
  const last=messages.at(-1);if(!last)return [];
  if(bytes([last])>budget)throw Error('Your latest message or attachments are too large. Reduce the file size and try again.');
  const kept=[last];let used=bytes(last)+2;
  for(let i=messages.length-2;i>=0;i--){
    const item=messages[i],size=bytes(item)+1;
    if(used+size>budget)break;
    kept.unshift(item);used+=size;
  }
  // Never begin the retained conversation with an orphan assistant turn.
  while(kept.length>1&&kept[0].role==='assistant')kept.shift();
  return kept;
}
export function continuationMessages(messages,partial){
  return [...messages,{role:'assistant',content:partial.slice(-100000)},{role:'user',content:'Continue the previous answer exactly where it stopped. Do not repeat the existing text, introduction, or code fence opener. Preserve code syntax and finish the requested task. Return only the continuation.'}];
}
export function mergeContinuation(previous,next){
  if(!previous)return next;
  if(next.startsWith(previous))return next;
  const max=Math.min(previous.length,next.length,16000);
  for(let n=max;n>=32;n--)if(previous.endsWith(next.slice(0,n)))return previous+next.slice(n);
  return previous+next;
}
export function retryable(error){
  return /stream|disconnect|network|fetch|timeout|timed out|no final answer|incomplete|Provider (408|429|500|502|503|504)|Request failed \((408|429|500|502|503|504)\)/i.test(String(error?.message||error));
}
export async function readEvents(response,onEvent){
  if(!response.body)throw Error('Empty response stream.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',doneEvent=false;
  try{while(true){const {done,value}=await reader.read();buffer+=done?decoder.decode()+'\n':decoder.decode(value,{stream:true});
    const lines=buffer.split('\n');buffer=lines.pop();
    if(buffer.length>2_000_000)throw Error('Response event exceeded the safe size.');
    for(const line of lines){if(!line.trim())continue;const e=JSON.parse(line);if(e.type==='done'){doneEvent=true;break;}if(e.type==='error')throw Error(e.message||'Generation failed.');onEvent(e);}
    if(done||doneEvent)break;
  }if(!doneEvent)throw Error('Stream disconnected before completion.');
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export function isTerminalUsageError(error){return /(?:invalid or omitted terminal usage|missing terminal usage|invalid terminal usage)/i.test(String(error?.message||error));}
export function recoveryAttempts(previous,model){return previous?.recovery?.model===model?Math.min(3,Number(previous.recovery.attempts)||0):0;}
export function nextRecovery(previous,model,attempted=false){return {model,attempts:Math.min(3,recoveryAttempts(previous,model)+(attempted?1:0))};}
export function providerThinking(delta){if(typeof delta?.reasoning_content==='string')return delta.reasoning_content;if(typeof delta?.reasoning==='string')return delta.reasoning;return Array.isArray(delta?.reasoning_details)?delta.reasoning_details.filter(x=>x?.type==='reasoning.text'&&typeof x.text==='string').map(x=>x.text).join(''):'';}
