import type { JournalPageData } from './journal';
export function hasWriting(page:JournalPageData){return !!(page.text.length||(page.title??'').length);}
/** Device-specific IDs import each legacy page once, keeping phone and laptop entries distinct. */
export function importJournal(existing:JournalPageData[],legacy:JournalPageData[],device:string){
  const known=new Set(existing.map(p=>p.id));
  let last=legacy.length-1;while(last>=0&&!hasWriting(legacy[last]))last--;
  return [...existing,...legacy.slice(0,last+1).flatMap((page,i)=>{const id=`legacy-${device}-${i}`;return !known.has(id)?[{...page,id}]:[];})];
}
/** Save only pages edited by this tab, retaining entries received from another device. */
export function mergeJournal(latest:JournalPageData[],before:JournalPageData[],after:JournalPageData[]){
  const old=new Map(before.map(p=>[p.id,p]));
  const changed=new Map(after.filter(p=>p.id&&JSON.stringify(old.get(p.id))!==JSON.stringify(p)).map(p=>[p.id,p]));
  const result=latest.map(page=>changed.get(page.id)??page);
  const known=new Set(result.map(p=>p.id));
  for(const page of after)if(page.id&&!known.has(page.id)){result.push(page);known.add(page.id);}
  const byId=new Map(result.map(p=>[p.id,p]));
  return [...after.map(p=>byId.get(p.id)??p),...result.filter(p=>!after.some(a=>a.id===p.id))];
}
export function validJournal(value:unknown):boolean{
  if(!value||typeof value!=='object')return false;
  const {pages,lastWrittenPageId}=(value as {pages?:unknown;lastWrittenPageId?:unknown});
  if(lastWrittenPageId!==undefined&&typeof lastWrittenPageId!=='string')return false;
  return Array.isArray(pages)&&pages.every(p=>p&&typeof p.id==='string'&&p.id.length>0&&typeof p.text==='string'&&(p.title===undefined||typeof p.title==='string')&&typeof p.date==='string'&&Number.isFinite(Date.parse(p.date)))&&new Set(pages.map(p=>p.id)).size===pages.length;
}
