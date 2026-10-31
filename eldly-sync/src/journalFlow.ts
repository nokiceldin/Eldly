/** Find the last whole-word boundary that fits, falling back for a word longer than a page. */
export function pageBreak(text:string,fits:(value:string)=>boolean):number {
  if(fits(text))return text.length;
  let low=0,high=text.length;
  while(low<high){const mid=Math.ceil((low+high)/2);if(fits(text.slice(0,mid)))low=mid;else high=mid-1;}
  if(low===0)return 1;
  const prefix=text.slice(0,low);const boundary=Math.max(prefix.lastIndexOf(' '),prefix.lastIndexOf('\n'),prefix.lastIndexOf('\t'));
  return boundary>=0?boundary+1:low;
}
