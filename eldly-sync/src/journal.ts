import { scopedKey } from './accountScope';
export type JournalPageData = { text: string; title?: string; date: string };
export const newJournalPage = (): JournalPageData => ({ text: '', title: '', date: new Date().toISOString() });
export const bookColors = { sage: '#747e66', midnight: '#394958', rose: '#a07770', clay: '#a47e58', plum: '#6c5b72' };
export type BookDesign = { title: string; subtitle: string; color: keyof typeof bookColors; paper: 'cream' | 'white'; ruled: boolean };
export const defaultBook: BookDesign = { title: 'My journal', subtitle: '', color: 'sage', paper: 'cream', ruled: true };
export function readBook(): BookDesign {
  try { const d = JSON.parse(localStorage.getItem(scopedKey('journal:design:v1')) || 'null');
    if (d && typeof d.title === 'string' && typeof d.subtitle === 'string' && Object.hasOwn(bookColors,d.color)) return { title:d.title,subtitle:d.subtitle,color:d.color,paper:d.paper==='white'?'white':'cream',ruled:d.ruled!==false };
  } catch { /* Use the default cover. */ }
  return defaultBook;
}
export function readJournalPages(key: string): JournalPageData[] {
  try { const d: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    if (Array.isArray(d) && d.length && d.length % 2 === 0 && d.every(p=>p && typeof p.text==='string' && (p.title===undefined || typeof p.title==='string') && typeof p.date==='string' && Number.isFinite(Date.parse(p.date)))) return d;
  } catch { /* Preserve storage and open a blank book. */ }
  return [newJournalPage(),newJournalPage()];
}
export function readJournalPosition(length: number): number {
  try {const n=Number(localStorage.getItem(scopedKey('journal:position:v1')));return Number.isInteger(n)&&n>=0?Math.min(n,length-1):0;}catch{return 0;}
}
/** Keep five or six spare pages, rounding up for a complete two-page spread. */
export function withJournalBuffer(pages:JournalPageData[]):JournalPageData[]{
  let last=-1;
  for(let i=pages.length-1;i>=0;i--)if(pages[i].text.length||(pages[i].title??'').length){last=i;break;}
  const count=Math.ceil((last+1+5)/2)*2;
  const result=pages.slice(0,count);
  while(result.length<count)result.push(newJournalPage());
  return result;
}
