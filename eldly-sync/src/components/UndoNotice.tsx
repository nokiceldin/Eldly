import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export const UNDO_DURATION=3000;
export default function UndoNotice({label,onUndo,onExpire}:{label:string;onUndo:()=>void;onExpire:()=>void}) {
 useEffect(()=>{
  const timer=setTimeout(onExpire,UNDO_DURATION);
  return ()=>clearTimeout(timer);
 },[onExpire]);
 return createPortal(<div className="undo-notice" role="status" aria-live="polite" aria-atomic="true">
  <span>{label}</span><button type="button" onClick={onUndo}>Undo</button>
 </div>,document.body);
}
