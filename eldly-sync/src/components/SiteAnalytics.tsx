import {useEffect,useState} from 'react';
import {Analytics} from '@vercel/analytics/react';
import {analyticsPath,publicPageview} from '../siteAnalytics';
export default function SiteAnalytics(){
 const [path,setPath]=useState(()=>analyticsPath(window.location.hash));
 useEffect(()=>{const update=()=>setPath(analyticsPath(window.location.hash));window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
 return <Analytics route={path} path={path} beforeSend={publicPageview} debug={false}/>;
}
