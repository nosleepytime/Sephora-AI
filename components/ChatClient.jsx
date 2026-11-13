'use client';
import dynamic from 'next/dynamic';
const Chat = dynamic(() => import('./Chat'), { ssr: false, loading: () => <div className="initial"><img src="/logo.jpg" alt="Sephora"/><span>Sephora</span></div> });
export default Chat;
