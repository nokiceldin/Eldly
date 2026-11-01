/** Find the last whole-word boundary that fits, falling back for a word longer than a page. */
export function pageBreak(text:string,fits:(value:string)=>boolean):number {
  if(fits(text))return text.length;
  let low=0,high=text.length;
  while(low<high){const mid=Math.ceil((low+high)/2);if(fits(text.slice(0,mid)))low=mid;else high=mid-1;}
  if(low===0)return 1;
  const prefix=text.slice(0,low);const boundary=Math.max(prefix.lastIndexOf(' '),prefix.lastIndexOf('\n'),prefix.lastIndexOf('\t'));
  return boundary>=0?boundary+1:low;
}

import {newJournalPage,type JournalPageData} from './journal';
export const JOURNAL_PAPER={width:420,height:600,textWidth:344,textHeight:448,fontSize:22,lineHeight:28};
/** Split each original page independently: titles and following entries stay attached to their writing. */
export function paginateJournal(pages:JournalPageData[],fits:(text:string)=>boolean,reserved:JournalPageData[]=pages){
  const ids=new Set(reserved.map(p=>p.id));const result:JournalPageData[]=[];
  for(const page of pages){let text=page.text,part=0;
    let current=page;
    while(!fits(text)){
      const cut=pageBreak(text,fits);if(cut>=text.length)break;
      result.push({...current,text:text.slice(0,cut)});text=text.slice(cut);
      let id:string;do{id=`${page.id}:continuation:${++part}`;}while(ids.has(id));ids.add(id);
      current={...newJournalPage(),id,date:page.date};
    }
    result.push({...current,text});
  }
  return result;
}
export function journalMeasure(){
 const field=document.createElement('textarea');field.tabIndex=-1;field.setAttribute('aria-hidden','true');
 field.style.cssText=`position:fixed;left:-10000px;top:0;visibility:hidden;box-sizing:border-box;width:${JOURNAL_PAPER.textWidth}px;height:${JOURNAL_PAPER.textHeight}px;padding:0;border:0;font:22px/28px 'Journal Hand';letter-spacing:normal;white-space:pre-wrap;overflow-wrap:break-word;resize:none;`;
 document.body.append(field);
 return {fits:(value:string)=>{field.value=value;return field.scrollHeight<=field.clientHeight;},remove:()=>field.remove()};
}
