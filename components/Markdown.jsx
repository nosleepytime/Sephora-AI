'use client';import {memo,useMemo,useState} from 'react';import {splitMarkdown,chunkCode} from '../lib/markdown-stream.mjs';import ReactMarkdown from 'react-markdown';import remarkGfm from 'remark-gfm';import remarkMath from 'remark-math';import rehypeKatex from 'rehype-katex';import 'katex/dist/katex.min.css';import rehypeSanitize,{defaultSchema} from 'rehype-sanitize';import {Download,Copy} from 'lucide-react';
const gif='https://mir-s3-cdn-cf.behance.net/project_modules/source/bea83775357853.5c4a1808c8a7b.gif';
function Chart({code}){try{const x=JSON.parse(code);if(!Array.isArray(x.items)||x.items.length>20)throw Error();const max=Math.max(1,...x.items.map(i=>Math.abs(Number(i.value)||0)));return <div className="chart"><b>{String(x.title||'Comparison')}</b>{x.items.map((i,k)=><div key={k}><span>{String(i.label)}</span><div className="charttrack"><div style={{width:Math.min(100,Math.abs(Number(i.value)||0)/max*100)+'%'}}/></div><b>{String(i.value)}</b></div>)}</div>}catch{return <pre>{code}</pre>}}
const Text=memo(function Text({text}){return <ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeSanitize,{...defaultSchema,attributes:{...defaultSchema.attributes,code:[['className',/^language-./,'math-inline','math-display']]}}],rehypeKatex]} components={{a:({node,...p})=><a {...p} target="_blank" rel="noopener noreferrer"/>,img:({node,...p})=><img {...p} loading="lazy"/>,pre:({node,children})=>{const code=node.children?.[0];const cls=code?.properties?.className?.[0];const value=code?.children?.map(x=>x.value||'').join('')||'';return cls==='language-sephora-chart'?<Chart code={value}/>:<div className="codebox"><div className="codebar"><span>{cls?.replace('language-','')||'Code'}</span><button onClick={()=>navigator.clipboard.writeText(value)}><Copy size={14}/> Copy</button></div><pre>{children}</pre></div>}}}>{text}</ReactMarkdown>});
// Stable code chunks avoid re-highlighting the entire file every token.
const TOKENS=/(&lt;[\w-]+|<\/?[\w:-]+|<!--[^\n]*|\/\/[^\n]*|\/\*[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|class|if|else|for|while|async|await|import|export|new|true|false|null|document|window)\b|\b\d+(?:\.\d+)?\b|#[0-9a-fA-F]{3,8}\b)/g;
const CodeChunk=memo(function CodeChunk({text,highlight}){
  if(!highlight||text.length>16000)return <span>{text}</span>;
  const nodes=[];let pos=0;
  for(const m of text.matchAll(TOKENS)){
    if(m.index>pos)nodes.push(text.slice(pos,m.index));
    const token=m[0],type=token.startsWith('//')||token.startsWith('/*')||token.startsWith('<!--')?'comment':token[0]==='"'||token[0]==="'"?'string':token[0]==='<'||token.startsWith('&lt;')?'tag':/^[\d#]/.test(token)?'number':'keyword';
    nodes.push(<span className={'syntax-'+type} key={m.index}>{token}</span>);pos=m.index+token.length;
  }
  if(pos<text.length)nodes.push(text.slice(pos));
  return <span>{nodes}</span>;
});
const LiveCode=memo(function LiveCode({block,streaming}){
  const [copied,setCopied]=useState(false);
  const chunks=useMemo(()=>chunkCode(block.text),[block.text]);
  const highlight=block.lang!=='text'&&block.lang!=='plaintext';
  function download(){const url=URL.createObjectURL(new Blob([block.text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');const ext=({javascript:'js',typescript:'ts',python:'py',html:'html',css:'css',json:'json',bash:'sh',markdown:'md'})[block.lang]||(/^[a-z0-9]{1,8}$/i.test(block.lang)&&block.lang!=='text'?block.lang:'txt');a.href=url;a.download='sephora-code.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  return <div className="codebox live-code"><div className="codebar"><span>{block.lang==='text'?'Code':block.lang}{streaming&&!block.closed&&<small className="code-writing"> · Writing…</small>}</span><div className="code-actions"><button onClick={download} aria-label="Download code"><Download size={14}/><span>Download</span></button><button onClick={()=>navigator.clipboard.writeText(block.text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500)}).catch(()=>{})}><Copy size={14}/> {copied?'Copied':'Copy'}</button></div></div><pre><code>{chunks.map((chunk,i)=><CodeChunk key={i} text={chunk} highlight={highlight}/>)}</code></pre></div>;
});
const FormattedText=memo(function FormattedText({text,streaming}){
  const blocks=useMemo(()=>splitMarkdown(text),[text]);
  return <>{blocks.map(block=>block.kind==='markdown'?<Text key={block.key} text={block.text}/>:block.lang==='sephora-chart'&&block.closed?<Chart key={block.key} code={block.text}/>:<LiveCode key={block.key} block={block} streaming={streaming}/>)}</>;
});
function Markdown({text='',images={},streaming=false}){const seen=new Set();const parts=text.split(/(\[\[IMAGE:\d+\]\]|\[\[IMAGE_PROMPT:[\s\S]*?\]\])/g);const render=(id,k)=>{seen.add(String(id));const a=images[id];return <div className="image-result" key={k}>{a?.src?<><img src={a.src} alt={a.prompt||'Generated image'}/><a download="sephora-image.jpg" href={a.src}><Download size={16}/> Download</a></>:a?.error?<div className="error">{a.error}</div>:<div className="image-loading"><img src={gif} alt="Generating"/><span>Creating your image…</span></div>}</div>};const elements=parts.map((p,k)=>{const m=p.match(/^\[\[IMAGE:(\d+)\]\]$/);return m?render(m[1],k):/^\[\[IMAGE_PROMPT:/.test(p)?render('fallback-'+k,k):<FormattedText key={k} text={p} streaming={streaming}/>});return <div className="markdown">{elements}{Object.keys(images).filter(k=>!seen.has(k)).map(k=>render(k,'extra'+k))}</div>}

export default memo(Markdown);
