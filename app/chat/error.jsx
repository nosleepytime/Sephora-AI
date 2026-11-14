'use client';
import {useEffect} from 'react';
export default function ChatError({error,reset}){
useEffect(()=>{console.error('Sephora chat recovery:',error?.digest||error?.name||'unknown')},[error]);
return <main className="chat-recovery"><h1>Sephora needs a moment</h1><p>The chat ran into an unexpected problem. Your saved conversations remain on this device. Try recovering the chat; if that fails, reload the page.</p><button onClick={()=>reset()}>Recover chat</button><a href="/chat">Reload chat</a></main>
}
