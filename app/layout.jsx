import './globals.css';
export const metadata={title:'Sephora AI — Your next idea',description:'Think, create and connect with Sephora AI.',manifest:'/manifest.webmanifest',icons:{icon:'/icon-192.png',apple:'/icon-192.png'}};
export const viewport={width:'device-width',initialScale:1,themeColor:'#101015'};
export default function Layout({children}){return <html lang="en"><body>{children}</body></html>}
