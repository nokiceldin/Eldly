import { useState, type CSSProperties } from 'react';
import { Feather } from 'lucide-react';
import { bookColors, readBook, type BookDesign } from '../journal';
import { scopedKey } from '../accountScope';
import './journal.css';
export default function BookDesigner() {
  const [design,setDesign]=useState(readBook);
  const [error,setError]=useState('');
  function update(patch: Partial<BookDesign>){const next={...design,...patch};setDesign(next);try{localStorage.setItem(scopedKey('journal:design:v1'),JSON.stringify(next));window.dispatchEvent(new Event('journal-design'));setError('');}catch{setError('Couldn’t save book design on this device.');}}
  return <details className="book-designer"><summary>Your journal</summary><div className="book-design-layout"><div className="book-design-preview" style={{'--book-color':bookColors[design.color]} as CSSProperties}><Feather size={22}/><strong>{design.title}</strong><small>{design.subtitle}</small></div><div className="book-design-fields"><label>Cover title<input maxLength={60} value={design.title} onChange={e=>update({title:e.target.value})}/></label><label>Cover subtitle<input maxLength={80} value={design.subtitle} onChange={e=>update({subtitle:e.target.value})}/></label><fieldset><legend>Cover color</legend><div className="book-color-options">{Object.entries(bookColors).map(([color,value])=><button key={color} type="button" aria-label={`${color} cover`} aria-pressed={design.color===color} style={{background:value}} onClick={()=>update({color:color as BookDesign['color']})}/>)}</div></fieldset><label>Paper<select value={design.paper} onChange={e=>update({paper:e.target.value as BookDesign['paper']})}><option value="cream">Warm cream</option><option value="white">Soft white</option></select></label><label className="book-rule-option"><input type="checkbox" checked={design.ruled} onChange={e=>update({ruled:e.target.checked})}/> Lined pages</label></div></div>{error&&<p role="alert">{error}</p>}</details>;
}
