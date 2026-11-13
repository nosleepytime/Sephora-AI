import {createHmac,timingSafeEqual} from 'node:crypto';import {authenticator} from 'otplib';
export const mode=()=>['coming-soon','maintenance'].includes(process.env.SITE_MODE||'')?process.env.SITE_MODE:'public';
const sign=s=>createHmac('sha256',process.env.SESSION_SECRET||'').update(s).digest('hex');const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
export function session(){const s=String(Date.now()+8*3600e3);return s+'.'+sign(s)}
export function valid(token){if(!process.env.SESSION_SECRET||!token)return false;const [s,h]=token.split('.');return !!s&&!!h&&Number(s)>Date.now()&&eq(h,sign(s))}
export function credentials(password,code){if(!process.env.DEV_PASSWORD||!process.env.DEV_TOTP_SECRET||!process.env.SESSION_SECRET)return false;return eq(password||'',process.env.DEV_PASSWORD)&&authenticator.check(String(code||''),process.env.DEV_TOTP_SECRET)}
