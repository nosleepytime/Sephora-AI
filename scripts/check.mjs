import {readFileSync,existsSync} from 'node:fs';import assert from 'node:assert/strict';const m=JSON.parse(readFileSync('models.json','utf8'));assert.equal(m.chat[0].id,'community/morriszdweck/glm-5.3-flash-free');assert.deepEqual(m.transcription,['community/Saauf/whisper-large-v3-turbo','community/Saauf/whisper-large-v3']);assert.equal(m.speech,'fish-audio/s2.1-pro-free:free');for(const f of ['app/page.jsx','app/chat/page.jsx','app/api/[action]/route.js','components/Chat.jsx','components/useVoice.js','public/logo.jpg','desktop/main.cjs','scripts/mobile.mjs'])assert.ok(existsSync(f),f);const s=readFileSync('app/api/[action]/route.js','utf8');assert.match(s,/gen\.pollinations\.ai/);assert.match(s,/openrouter\.ai\/api\/v1\/audio\/speech/);console.log('Project layout and model identifiers verified.');

import {normalizeResponse,createAnswerStream} from '../lib/response.mjs';
const sample='<think>The user said Yo. Return exactly one JSON object. {"name":null,"message":"draft"}</think>\n\n{"name":null,"message":"Hey there! 👋 How can I help you today?"}';
assert.equal(normalizeResponse(sample).text,'Hey there! 👋 How can I help you today?');
assert.equal(normalizeResponse(sample).reasoned,true);
assert.equal(normalizeResponse('<think>private without closing').text,'');
assert.equal(normalizeResponse('{"name":null,"message":"Hello\\n**world**"}').text,'Hello\n**world**');
assert.deepEqual(normalizeResponse('{"name":"calculate","arguments":{"expression":"2+2"}}').call,{name:'calculate',arguments:{expression:'2+2'}});
assert.equal(normalizeResponse('{"hello":"world"}').text,'{"hello":"world"}');
assert.equal(normalizeResponse('```json\n{"a":1}\n```').text,'```json\n{"a":1}\n```');
let output='',seen=false;const stream=createAnswerStream(x=>output+=x,()=>seen=true);
for(const chunk of ['<th','ink>secret','</thi','nk>','{"name":null,','"message":"Hi!"}'])stream.push(chunk);
assert.equal(output,'');stream.finish();assert.equal(output,'Hi!');assert.equal(seen,true);
let plain='';const normal=createAnswerStream(x=>plain+=x,()=>{});normal.push('Hello ');assert.equal(plain,'Hello ');normal.push('world');normal.finish();assert.equal(plain,'Hello world');
let interleaved='';const mixed=createAnswerStream(x=>interleaved+=x,()=>{});for(const x of ['Hello ', '<th','ink>private','</think>','world'])mixed.push(x);mixed.finish();assert.equal(interleaved,'Hello world');
console.log('Reasoning and response normalization tests passed.');
