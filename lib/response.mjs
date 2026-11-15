// Provider routing metadata is not user-visible answer content.
const TAG=/<\/?(?:think|thinking|reasoning|analysis)(?:\s[^<>]*)?>/gi;
// Some community models put a quoted Thinking... preamble in content.
// Recognize only an explicit initial heading followed by quoted lines.
const THINK_HEAD=/^\s*Thinking(?:\.{3}|…)[ \t]*\r?\n/i;
function legacyReasoning(raw,streaming=false){
  const lead=raw.trimStart();
  if(streaming&&lead&&'thinking...'.startsWith(lead.toLowerCase()))return {answer:'',reasoned:false,pending:true};
  const m=raw.match(THINK_HEAD);
  if(!m)return {answer:raw,reasoned:false,pending:false};
  const rest=raw.slice(m[0].length);
  if(!rest.trim()&&streaming)return {answer:'',reasoned:false,pending:true};
  if(!/^\s*>/.test(rest))return {answer:raw,reasoned:false,pending:false};
  let pos=0,reasoning='';
  while(pos<rest.length){
    const e=rest.indexOf('\n',pos),end=e<0?rest.length:e+1;
    const line=rest.slice(pos,end);
    if(/^\s*>/.test(line)){reasoning+=line.replace(/^\s*>[ \t]?/,'');pos=end;continue;}if(!line.trim()){reasoning+=line;pos=end;continue;}
    return {answer:rest.slice(pos),reasoned:true,pending:false,reasoning};
  }
  return {answer:'',reasoned:true,pending:streaming,reasoning};
}
export function stripReasoning(raw,streaming=false){
  const original=String(raw||'');
  const legacy=legacyReasoning(original,streaming);
  const source=legacy.answer;
  let depth=0,end=0,answer='',reasoned=legacy.reasoned,fence=null,reasoning=legacy.reasoning||'';
  const tokens=/^[ ]{0,3}(`{3,}|~{3,})[^\n]*|<\/?(?:think|thinking|reasoning|analysis)(?:\s[^<>]*)?>/gim;
  for(const match of source.matchAll(tokens)){
    if(!depth)answer+=source.slice(end,match.index);else reasoning+=source.slice(end,match.index);
    if(match[1]){
      if(!depth){
        if(!fence)fence=match[1];
        else if(match[1][0]===fence[0]&&match[1].length>=fence.length&&match[0].trim()===match[1])fence=null;
        answer+=match[0];
      }else reasoning+=match[0];
    }else if(fence&&!depth){answer+=match[0]}
    else if(match[0][1]==='/')depth=Math.max(0,depth-1);
    else{depth++;reasoned=true}
    end=match.index+match[0].length;
  }
  if(!depth)answer+=source.slice(end);else{let tail=source.slice(end);if(streaming)tail=tail.replace(/<\/?[a-z]*$/i,'');reasoning+=tail;}
  return {answer,reasoned,reasoning,pending:legacy.pending};
}
export function normalizeResponse(raw){
  const {answer,reasoned,reasoning}=stripReasoning(raw);
  const trimmed=answer.trim();
  const fenced=trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  const candidate=fenced?fenced[1].trim():trimmed;
  try{
    const x=JSON.parse(candidate);
    if(x&&typeof x==='object'&&!Array.isArray(x)){
      const keys=Object.keys(x);
      if(x.name===null&&typeof x.message==='string'&&keys.every(k=>k==='name'||k==='message')){
        return {text:stripReasoning(x.message).answer.trim(),reasoned,reasoning,call:null};
      }
      if(typeof x.name==='string'&&x.arguments&&typeof x.arguments==='object'&&!Array.isArray(x.arguments)&&keys.every(k=>k==='name'||k==='arguments')){
        return {text:'',reasoned,reasoning,call:{name:x.name,arguments:x.arguments}};
      }
    }
  }catch{}
  return {text:answer,reasoned,call:null};
}
// Decode a router message as its JSON string arrives, without exposing the wrapper.
function routerPrefix(value){
  const prefix=value.trimStart().match(/^\{\s*"name"\s*:\s*null\s*,\s*"message"\s*:\s*"/);
  if(!prefix)return null;
  const tail=value.trimStart().slice(prefix[0].length);let end=0;
  for(let i=0;i<tail.length;i++){
    const c=tail[i];
    if(c==='"')break;
    if(c==='\\'){if(i+1>=tail.length)break;if(tail[i+1]==='u'){if(i+5>=tail.length||!/^[0-9a-f]{4}$/i.test(tail.slice(i+2,i+6)))break;i+=5;}else i++;}
    end=i+1;
  }
  try{return JSON.parse('"'+tail.slice(0,end)+'"')}catch{return null}
}
// Plain text and recognized answer envelopes stream; other JSON remains buffered.
export function createAnswerStream(emit,onReasoning,onThought=()=>{}){
  let raw='',sent='',mode='',thoughtSent='';const publishThought=clean=>{if(clean.reasoned)onReasoning();const value=clean.reasoning||'';if(value.startsWith(thoughtSent)&&value.length>thoughtSent.length){onThought(value.slice(thoughtSent.length));thoughtSent=value}};
  const publish=visible=>{if(visible.startsWith(sent)&&visible.length>sent.length){emit(visible.slice(sent.length));sent=visible}};
  return {
    push(chunk){
      raw+=chunk;
      const clean=stripReasoning(raw,true);
      publishThought(clean);
      if(clean.pending)return;let visible=clean.answer;
      if(!mode){const lead=visible.trimStart();if(!lead||lead==='<'||lead.startsWith('<')&&!lead.includes('>'))return;if(lead.startsWith('`')&&(/^\x60{1,2}$/.test(lead)||/^\x60{3,}[^\n]*$/.test(lead)))return;mode=lead.startsWith('{')?'json':/^\x60{3,}json\s*\n/i.test(lead)?'buffer':'plain';}
      if(mode==='json'){const text=routerPrefix(visible);if(text!==null)publish(text);return;}
      if(mode==='buffer')return;
      const tail=visible.lastIndexOf('<');
      if(tail>=0&&!visible.slice(tail).includes('>')&&/^<\/?[a-z]*$/i.test(visible.slice(tail)))visible=visible.slice(0,tail);
      publish(visible);
    },
    finish(){
      const result=normalizeResponse(raw);
      publishThought(result);
      if(mode==='json'&&routerPrefix(stripReasoning(raw).answer)!==null&&result.text.trimStart().startsWith('{"name"'))throw Error('Upstream response ended with an incomplete routing envelope.');
      publish(result.text);
      return result;
    }
  };
}
