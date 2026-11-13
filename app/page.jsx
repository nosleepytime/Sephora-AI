import {cookies} from 'next/headers';import {redirect} from 'next/navigation';import {mode,valid} from '../lib/auth';import Home from '../components/Home';
export const dynamic='force-dynamic';export default async function Page(){if(mode()!=='public'&&!valid((await cookies()).get('sephora-dev')?.value))redirect('/'+mode());return <Home/>}
