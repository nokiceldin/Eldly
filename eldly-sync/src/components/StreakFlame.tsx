import {useId} from 'react';
export default function StreakFlame({size=28}:{size?:number}){
 const id=useId();
 return <svg className="streak-flame" width={size} height={size} viewBox="0 0 80 96" fill="none" aria-hidden="true"><defs><linearGradient id={id} x1="40" y1="8" x2="40" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#ffbb48"/><stop offset=".52" stopColor="#ff693b"/><stop offset="1" stopColor="#ee3c59"/></linearGradient></defs><path d="M42 4C48 24 70 30 65 48C73 44 73 36 73 36C88 65 70 91 42 92C12 94-1 71 8 51C10 61 17 63 17 63C10 37 38 29 42 4Z" fill={`url(#${id})`} stroke="#ffb763" strokeWidth="2"/><path d="M43 37C45 52 58 56 57 68C56 81 48 85 39 84C25 83 21 73 26 63C26 70 31 71 31 71C28 59 40 52 43 37Z" fill="#ffe89a"/><path d="M44 63C49 73 50 78 42 82C34 82 34 75 38 71Z" fill="#fff6d5"/><path d="M24 35L28 27M57 20L60 15" stroke="#ffd48a" strokeWidth="3" strokeLinecap="round"/></svg>;
}
