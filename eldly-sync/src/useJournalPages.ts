import {useEffect,useRef,useState,type SetStateAction} from 'react';
import {scopedKey} from './accountScope';
import {readJournalPages,withJournalBuffer,type JournalPageData} from './journal';
import {importJournal,mergeJournal} from './journalSync';
import {load,persist} from './storage';
import {LOCAL_EVENT,REMOTE_EVENT} from './sync/local';

function migrate(){
  const data=load();
  const legacy=readJournalPages(scopedKey('journal:v1'));
  const deviceKey=scopedKey('journal:legacy-device');
  let device=localStorage.getItem(deviceKey);
  if(!device){device=crypto.randomUUID();localStorage.setItem(deviceKey,device);}
  const existing=data.journal?.pages??[];
  const pages=importJournal(existing,legacy,device);
  if(pages.length!==existing.length){
    // Keep the old journal:v1 intact as a recovery copy; imports are idempotent.
    persist({...data,journal:{pages}});
  }
  return withJournalBuffer(pages);
}
export function useJournalPages(){
  const [initial]=useState(()=>{try{return {pages:withJournalBuffer(load().journal?.pages??[]),error:false};}catch{return {pages:withJournalBuffer(readJournalPages(scopedKey('journal:v1'))),error:true};}});
  const [pages,setState]=useState(initial.pages),[saveError,setSaveError]=useState(initial.error);
  const current=useRef(pages);
  useEffect(()=>{
    try{current.current=migrate();setState(current.current);setSaveError(false);}catch{setSaveError(true);}
    const refresh=()=>{try{
      const remote=load().journal?.pages??[];
      const blanks=current.current.filter(p=>!p.text.length&&!(p.title??'').length&&!remote.some(r=>r.id===p.id));
      const next=withJournalBuffer([...remote,...blanks]);
      if(JSON.stringify(next)!==JSON.stringify(current.current)){current.current=next;setState(next);}
    }catch{setSaveError(true);}};
    window.addEventListener(LOCAL_EVENT,refresh);window.addEventListener(REMOTE_EVENT,refresh);window.addEventListener('storage',refresh);
    return()=>{window.removeEventListener(LOCAL_EVENT,refresh);window.removeEventListener(REMOTE_EVENT,refresh);window.removeEventListener('storage',refresh);};
  },[]);
  function setPages(action:SetStateAction<JournalPageData[]>){
    const before=current.current,next=typeof action==='function'?action(before):action;
    current.current=next;setState(next);
    try{
      const data=load();
      const merged=mergeJournal(data.journal?.pages??[],before,next);
      // Keep an independent local recovery copy before the shared sync engine runs.
      localStorage.setItem(scopedKey('journal:recovery:v2'),JSON.stringify(next));
      persist({...data,journal:{pages:merged}});
      setSaveError(false);
    }catch{setSaveError(true);}
  }
  return {pages,setPages,saveError};
}
