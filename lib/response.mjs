// Provider routing metadata is not user-visible answer content.
const TAG=/<\/?(?:think|thinking|reasoning|analysis)(?:\s[^<>]*)?>/gi;
export function stripReasoning(raw){
  let depth=0, end=0, answer='', reasoned=false;
  for(const match of String(raw||'').matchAll(TAG)){
    if(!depth)answer+=String(raw||'').slice(end,match.index);
    if(match[0][1]==='/')depth=Math.max(0,depth-1);
    else{depth++;reasoned=true}
    end=match.index+match[0].length;
  }
  if(!depth)answer+=String(raw||'').slice(end);
  return {answer,reasoned};
}
export function normalizeResponse(raw){
  const {answer,reasoned}=stripReasoning(raw);
  const trimmed=answer.trim();
  const fenced=trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  const candidate=fenced?fenced[1].trim():trimmed;
  try{
    const x=JSON.parse(candidate);
    if(x&&typeof x==='object'&&!Array.isArray(x)){
      const keys=Object.keys(x);
      if(x.name===null&&typeof x.message==='string'&&keys.every(k=>k==='name'||k==='message')){
        return {text:stripReasoning(x.message).answer.trim(),reasoned,call:null};
      }
      if(typeof x.name==='string'&&x.arguments&&typeof x.arguments==='object'&&!Array.isArray(x.arguments)&&keys.every(k=>k==='name'||k==='arguments')){
        return {text:'',reasoned,call:{name:x.name,arguments:x.arguments}};
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
export function createAnswerStream(emit,onReasoning){
  let raw='',sent='',mode='';
  const publish=visible=>{if(visible.startsWith(sent)&&visible.length>sent.length){emit(visible.slice(sent.length));sent=visible}};
  return {
    push(chunk){
      raw+=chunk;
      const clean=stripReasoning(raw);
      if(clean.reasoned)onReasoning();
      let visible=clean.answer;
      if(!mode){const lead=visible.trimStart();if(!lead||lead==='<'||lead.startsWith('<')&&!lead.includes('>'))return;mode=lead.startsWith('{')?'json':lead.startsWith('`')?'buffer':'plain';}
      if(mode==='json'){const text=routerPrefix(visible);if(text!==null)publish(text);return;}
      if(mode==='buffer')return;
      const tail=visible.lastIndexOf('<');
      if(tail>=0&&!visible.slice(tail).includes('>')&&/^<\/?[a-z]*$/i.test(visible.slice(tail)))visible=visible.slice(0,tail);
      publish(visible);
    },
    finish(){
      const result=normalizeResponse(raw);
      if(result.reasoned)onReasoning();
      if(mode==='json'&&routerPrefix(stripReasoning(raw).answer)!==null&&result.text.trimStart().startsWith('{"name"'))throw Error('Upstream response ended with an incomplete routing envelope.');
      publish(result.text);
      return result;
    }
  };
}
