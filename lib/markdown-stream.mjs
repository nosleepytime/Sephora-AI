// Top-level fenced code is rendered incrementally, including an unclosed fence.
export function splitMarkdown(text){
  const blocks=[];let start=0,pos=0,open=null;
  while(pos<text.length){
    const newline=text.indexOf('\n',pos),end=newline<0?text.length:newline+1;
    const line=text.slice(pos,end).replace(/\r?\n$/,'');
    const fence=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(!open&&fence&&!(fence[1][0]==='`'&&fence[2].includes('`'))){
      if(pos>start)blocks.push({kind:'markdown',text:text.slice(start,pos),key:start});
      open={key:pos,marker:fence[1],lang:fence[2].trim().split(/\s+/)[0]||'text',start:end};
    }else if(open&&fence&&fence[1][0]===open.marker[0]&&fence[1].length>=open.marker.length&&!fence[2].trim()){
      blocks.push({kind:'code',key:open.key,lang:open.lang,text:text.slice(open.start,pos),closed:true});open=null;start=end;
    }
    pos=end;
  }
  if(open)blocks.push({kind:'code',key:open.key,lang:open.lang,text:text.slice(open.start),closed:false});
  else if(start<text.length)blocks.push({kind:'markdown',text:text.slice(start),key:start});
  return blocks;
}
export function chunkCode(text,maxLines=48){
  const lines=text.split('\n'),out=[];
  for(let i=0;i<lines.length;i+=maxLines)out.push(lines.slice(i,i+maxLines).join('\n')+(i+maxLines<lines.length?'\n':''));
  return out;
}
