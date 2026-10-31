import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Feather, X, Maximize2, Minimize2, BookOpen, FileText } from 'lucide-react';
import { scopedKey } from '../accountScope';
import { bookColors, withJournalBuffer, newJournalPage, readBook, readJournalPages, readJournalPosition, type JournalPageData } from '../journal';
import './journal.css';
import { pageBreak } from '../journalFlow';

type Turn = { from:number; to:number; direction:number };
export default function JournalPage({ onHome }: { onHome: () => void }) {
  const key=scopedKey('journal:v1');
  const [pages,setPages]=useState(()=>withJournalBuffer(readJournalPages(key)));
  const [index,setIndex]=useState(0),[opened,setOpened]=useState(false);
  const [design,setDesign]=useState(readBook);
  const [saveError,setSaveError]=useState(false),[turn,setTurn]=useState<Turn|null>(null),[returning,setReturning]=useState(false);
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:600px)').matches);
  const [onePage,setOnePage]=useState(()=>{try{return localStorage.getItem(scopedKey('journal:one-page'))==='true';}catch{return false;}});
  const [fullscreen,setFullscreen]=useState(false);
  const space=useRef<HTMLElement>(null);
  const nativeFullscreen=useRef(false);
  const single=mobile||onePage;
  const position=useRef(readJournalPosition(pages.length));
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const locked=useRef(false);
  const touch=useRef<{x:number;y:number}|null>(null);
  const fields=useRef(new Map<number,HTMLTextAreaElement>());
  const pendingCaret=useRef<{page:number;offset:number}|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step=single?1:2;
  useEffect(()=>{
    heading.current?.focus();
    const mq=window.matchMedia('(max-width:600px)');const resize=()=>setMobile(mq.matches);mq.addEventListener('change',resize);
    const update=()=>setDesign(readBook());window.addEventListener('journal-design',update);
    return()=>{mq.removeEventListener('change',resize);window.removeEventListener('journal-design',update);clearTimeout(timer.current);};
  },[]);
  useEffect(()=>{if(!single)setIndex(i=>i-i%2);},[single]);
  useEffect(()=>{
    const change=()=>{if(nativeFullscreen.current&&!document.fullscreenElement){nativeFullscreen.current=false;setFullscreen(false);}};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setFullscreen(false);if(document.fullscreenElement===space.current)void document.exitFullscreen().catch(()=>{});}};
    document.addEventListener('fullscreenchange',change);window.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('fullscreenchange',change);window.removeEventListener('keydown',escape);};
  },[]);
  useEffect(()=>{if(!fullscreen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[fullscreen]);
  async function toggleFullscreen(){
    if(fullscreen){setFullscreen(false);if(document.fullscreenElement===space.current)await document.exitFullscreen().catch(()=>{});return;}
    setFullscreen(true);
    try{if(space.current?.requestFullscreen){await space.current.requestFullscreen();nativeFullscreen.current=true;}}catch{/* Keep the distraction-free layout when native fullscreen is unavailable. */}
  }
  function togglePages(){
    if(locked.current||returning)return;
    const next=!onePage;setOnePage(next);
    if(next)setIndex(position.current>=index&&position.current<index+2?position.current:index);
    try{localStorage.setItem(scopedKey('journal:one-page'),String(next));}catch{/* The view still changes for this session. */}
  }
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(pages));setSaveError(false);}catch{setSaveError(true);}},[key,pages]);
  useLayoutEffect(()=>{const target=pendingCaret.current;if(!target)return;const field=fields.current.get(target.page);if(field){field.focus({preventScroll:true});field.setSelectionRange(target.offset,target.offset);field.scrollTop=0;pendingCaret.current=null;}},[pages,index]);
  useEffect(()=>{if(index>=pages.length)setIndex(single?pages.length-1:pages.length-2);},[pages.length,index,single]);
  function jumpTo(value:string,field:HTMLInputElement,current:number){
    const number=Number(value);
    field.value=String(current+1);
    if(!value.trim()||!Number.isInteger(number)||number<1||number>pages.length||locked.current||returning)return;
    const page=number-1,next=single?page:page-page%2;
    remember(page);
    if(next===index)return;
    const distant=Math.abs(next-index)>step;
    
    animateTo(index,next,undefined,distant);
  }
  function remember(n:number){position.current=n;try{localStorage.setItem(scopedKey('journal:position:v1'),String(n));}catch{setSaveError(true);}}
  function animateTo(from:number,to:number,done?:()=>void,fast=false){
    locked.current=true;setTurn({from,to,direction:to>from?1:-1});
    timer.current=setTimeout(()=>{setIndex(to);setTurn(null);locked.current=false;done?.();},reduced()?0:fast?380:760);
  }
  function openBook(){
    const target=single?position.current:position.current-position.current%2;
    setIndex(0);setOpened(true);
    if(!target||reduced()){setIndex(target);return;}
    setReturning(true);locked.current=true;
    const stops=Array.from(new Set(Array.from({length:Math.min(4,Math.ceil(target/step))},(_,i)=>Math.ceil(target/step*(i+1)/Math.min(4,Math.ceil(target/step)))*step)));
    let from=0;
    const next=()=>{const to=stops.shift();if(to===undefined){setReturning(false);return;}animateTo(from,to,()=>{from=to;next();},true);};
    timer.current=setTimeout(next,350);
  }
  function flip(direction:number){
    if(locked.current||returning)return;
    const next=index+direction*step;if(next<0||next>=pages.length)return;
    remember(next);animateTo(index,next);
  }
  function edit(n:number,patch:Partial<JournalPageData>){setPages(p=>withJournalBuffer(p.map((page,i)=>i===n?{...page,...patch}:page)));remember(n);}
  function write(n:number,field:HTMLTextAreaElement){
    const text=field.value;
    if(field.scrollHeight<=field.clientHeight+1){edit(n,{text});return;}
    // Measure with the actual font and page geometry, including fullscreen and one-page layouts.
    const measure=field.cloneNode() as HTMLTextAreaElement;
    measure.removeAttribute('id');measure.removeAttribute('aria-label');measure.tabIndex=-1;measure.setAttribute('aria-hidden','true');
    const style=getComputedStyle(field);
    measure.style.cssText=`position:fixed;left:-10000px;top:0;visibility:hidden;box-sizing:${style.boxSizing};width:${field.getBoundingClientRect().width}px;height:${field.clientHeight}px;min-height:0;max-height:none;padding:${style.padding};border:0;font:${style.font};letter-spacing:${style.letterSpacing};white-space:pre-wrap;overflow-wrap:break-word;resize:none;`;
    document.body.appendChild(measure);
    const fits=(value:string)=>{measure.value=value;return measure.scrollHeight<=measure.clientHeight+1;};
    const updated=pages.map(p=>({...p}));updated[n].text=text;
    let current=n,caretPage=n,caretOffset=field.selectionStart;
    try{
      while(!fits(updated[current].text)){
        const content=updated[current].text,cut=pageBreak(content,fits);
        if(cut>=content.length)break;
        const overflow=content.slice(cut);updated[current].text=content.slice(0,cut);
        if(!updated[current+1])updated.push(newJournalPage(),newJournalPage());
        const existing=updated[current+1].text;
        updated[current+1].text=overflow+(existing&& !/\s$/.test(overflow)?'\n':'')+existing;
        if(caretPage===current&&caretOffset>=cut){caretPage++;caretOffset-=cut;}
        current++;
      }
    }finally{measure.remove();}
    pendingCaret.current={page:caretPage,offset:caretOffset};
    setPages(withJournalBuffer(updated));remember(caretPage);
    if(caretPage!==n){setIndex(single?caretPage:caretPage-caretPage%2);}
  }
  function paper(n:number,side:number,copy=false){
    const page=pages[n]??newJournalPage();
    return <div className={`journal-paper journal-paper-${side}${copy?' journal-paper-copy':''}`}>
      <div className="journal-paper-heading">{new Date(page.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</div>
      {copy?<><div className="journal-title-copy">{page.title}</div><div className="journal-text-copy">{page.text}</div></>:<><input className="journal-page-title" aria-label={`Title for page ${n+1}`} placeholder="Title" value={page.title??''} maxLength={100} disabled={!!turn||returning} onChange={e=>edit(n,{title:e.target.value})}/><textarea ref={field=>{if(field)fields.current.set(n,field);else fields.current.delete(n);}} aria-label={`Journal page ${n+1}`} spellCheck={false} placeholder="" value={page.text} onChange={e=>{if((e.nativeEvent as InputEvent).isComposing){edit(n,{text:e.target.value});return;}write(n,e.currentTarget);}} onCompositionEnd={e=>write(n,e.currentTarget)} disabled={!!turn||returning}/></>}
      {copy?<span className="journal-page-number">{n+1}</span>:<input key={`number-${n}`} className="journal-page-number journal-page-jump" aria-label={`Page ${n+1}, enter page number, 1 to ${pages.length}`} title={`Go to page (1–${pages.length})`} type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={n+1} disabled={!!turn||returning} onFocus={e=>e.currentTarget.select()} onBlur={e=>jumpTo(e.currentTarget.value,e.currentTarget,n)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.currentTarget.value=String(n+1);e.currentTarget.blur();e.stopPropagation();}}}/> }
    </div>;
  }
  // Reveal the destination underneath a two-sided leaf rotating around the binding.
  const shown=turn?.to??index;
  return <main ref={space} className={`journal-space journal-v2 ${single?'journal-single':''} ${fullscreen?'journal-fullscreen':''} ${design.paper==='white'?'journal-white':''} ${design.ruled?'':'journal-unruled'}`} style={{'--book-color':bookColors[design.color]} as CSSProperties}>
    <header className="journal-nav"><button onClick={onHome} aria-label="My space"><ArrowLeft size={18}/></button></header>
    <section className="journal-intro"><h1 ref={heading} tabIndex={-1}>Let your mind wander.</h1></section>
    {!opened?<button className="journal-cover" onClick={openBook} aria-label="Open your journal"><span className="journal-cover-border"><Feather size={30} strokeWidth={1}/><span className="journal-cover-title">{design.title}</span>{design.subtitle&&<span className="journal-cover-subtitle">{design.subtitle}</span>}</span><i className="journal-ribbon"/></button>:<section className="journal-book-area" aria-label="Your open journal" aria-busy={returning}>
      <div className={`journal-book ${turn?'is-turning':''} ${returning?'is-returning':''}`} onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{if(!touch.current)return;const t=e.changedTouches[0],dx=t.clientX-touch.current.x,dy=t.clientY-touch.current.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.8)flip(dx<0?1:-1);touch.current=null;}}>
        {paper(shown,0)}{!single&&paper(shown+1,1)}
        {turn&&<><div className={`journal-stationary journal-stationary-${turn.direction>0?'left':'right'}`} aria-hidden="true">{paper(turn.from+(turn.direction>0?0:single?0:1),turn.direction>0?0:1,true)}</div><div className={`journal-leaf journal-leaf-${turn.direction>0?'next':'previous'}`} aria-hidden="true"><div className="journal-leaf-front">{paper(turn.from+(turn.direction>0&&!single?1:0),turn.direction>0?1:0,true)}</div><div className="journal-leaf-back">{paper(turn.to+(turn.direction<0&&!single?1:0),turn.direction>0?0:1,true)}</div></div></>}
        <div className="journal-spine" aria-hidden="true"/><i className="journal-ribbon" aria-hidden="true"/>
      </div>
      <nav className="journal-pagination" aria-label="Journal pages"><button aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} title={fullscreen?'Exit fullscreen (Esc)':'Fullscreen'} aria-pressed={fullscreen} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button aria-label={single?'Show two-page spread':'Show one page'} title={single?'Two pages':'One page'} aria-pressed={single} disabled={mobile||!!turn||returning} onClick={togglePages}>{single?<BookOpen size={17}/>:<FileText size={17}/>}</button><button aria-label="Previous pages" disabled={index===0||!!turn||returning} onClick={()=>flip(-1)}><ChevronLeft size={18}/></button><button aria-label="Close journal" disabled={!!turn||returning} onClick={()=>{setOpened(false);if(fullscreen)void toggleFullscreen();}}><X size={15}/></button><button aria-label="Next pages" disabled={index+step>=pages.length||!!turn||returning} onClick={()=>flip(1)}><ChevronRight size={18}/></button></nav>
      <span className="sr-only" role="status">{returning?'Returning to your bookmark':`Page ${index+1}`}</span>
    </section>}
    {saveError&&<p className="journal-save-error" role="alert">Couldn’t save. Keep this page open and copy your writing.</p>}
  </main>;
}
