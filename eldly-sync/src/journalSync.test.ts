import {expect,it} from 'vitest';
import {importJournal,mergeJournal,validJournal} from './journalSync';
import {flatten,inflate,apply,diff} from './sync/records';
const page=(id:string,text:string)=>({id,text,title:'',date:'2026-11-01T12:00:00Z'});
it('imports both devices once and preserves blank pages before writing',()=>{
 const phone=[page('old','Phone entry')],laptop=[page('old',''),page('old2','Laptop entry')];
 const first=importJournal([],phone,'phone');const both=importJournal(first,laptop,'laptop');
 expect(both.map(p=>p.text)).toEqual(['Phone entry','','Laptop entry']);
 expect(importJournal(both,phone,'phone')).toEqual(both);
 const edited=both.map(p=>p.id==='legacy-phone-0'?{...p,text:'Edited phone entry'}:p);
 expect(importJournal(edited,phone,'phone')).toEqual(edited);
});
it('a stale save retains pages received from another device',()=>{
 const before=[page('a','Original'),page('blank','')];
 const remote=[...before,page('phone','Phone writing')];
 const saved=mergeJournal(remote,before,[page('a','Laptop edit'),page('blank','Continuation')]);
 expect(saved.map(p=>p.text)).toEqual(['Laptop edit','Continuation','Phone writing']);
});
it('retains concurrent new pages through the record-level sync merge',()=>{
 const baseline=flatten({'checkly-data-v1':{journal:{pages:[]}}});
 const phone=flatten({'checkly-data-v1':{journal:{pages:[page('phone','Phone entry')]}}});
 const laptop=flatten({'checkly-data-v1':{journal:{pages:[page('laptop','Laptop entry')]}}});
 const merged=inflate(apply(apply(baseline,diff(baseline,phone)),diff(baseline,laptop))) as any;
 expect(merged['checkly-data-v1'].journal.pages.map((p:any)=>p.text).sort()).toEqual(['Laptop entry','Phone entry']);
});
it('rejects invalid synced pages and duplicate identities',()=>{expect(validJournal({pages:[page('a','Entry')]})).toBe(true);expect(validJournal({pages:[page('a','Entry'),page('a','Other')]})).toBe(false);expect(validJournal({pages:[{text:'no id'}]})).toBe(false);});
