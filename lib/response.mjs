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
// Plain text can stream. Hold ambiguous tags and initial JSON/fenced
// output until classified; never send partial reasoning markup to the UI.
export function createAnswerStream(emit,onReasoning){
  let raw='',sent='',buffering=false,started=false;
  return {
    push(chunk){
      raw+=chunk;
      const clean=stripReasoning(raw);
      if(clean.reasoned)onReasoning();
      if(buffering)return;
      let visible=clean.answer;
      if(!started){
        const lead=visible.trimStart();
        if(!lead||lead==='<'||lead.startsWith('<')&&!lead.includes('>'))return;
        if(lead.startsWith('{')||lead.startsWith('`')){buffering=true;return}
        started=true;
      }
      // A provider can split an opening/closing tag across tokens.
      const tail=visible.lastIndexOf('<');
      if(tail>=0&&!visible.slice(tail).includes('>')&&/^<\/?[a-z]*$/i.test(visible.slice(tail)))visible=visible.slice(0,tail);
      if(visible.startsWith(sent)&&visible.length>sent.length){emit(visible.slice(sent.length));sent=visible}
    },
    finish(){
      const result=normalizeResponse(raw);
      if(result.reasoned)onReasoning();
      if(result.text.startsWith(sent)&&result.text.length>sent.length)emit(result.text.slice(sent.length));
      return result;
    }
  };
}
