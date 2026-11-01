import {expect,it} from 'vitest';
import {pageBreak} from './journalFlow';
it('moves the whole following word while preserving all characters',()=>{const text='A quiet moment to write';const cut=pageBreak(text,s=>s.length<=17);expect(text.slice(0,cut)).toBe('A quiet moment ');expect(text.slice(cut)).toBe('to write');expect(text.slice(0,cut)+text.slice(cut)).toBe(text);});
it('preserves paragraphs and supports long words',()=>{expect(pageBreak('first\nsecond',s=>s.length<=8)).toBe(6);expect(pageBreak('abcdefghijk',s=>s.length<=5)).toBe(5);});
it('keeps fitting text on the current page',()=>{expect(pageBreak('a full line',()=>true)).toBe(11);});

import {paginateJournal} from './journalFlow';
it('repaginates existing entries without changing text, titles, dates, or later entries',()=>{
 const original=[{id:'old',text:'one two three four five six seven',title:'My title',date:'2026-10-31T12:00:00Z'},{id:'next',text:'Another entry',title:'Tomorrow',date:'2026-11-01T12:00:00Z'}];
 const next=paginateJournal(original,s=>s.length<=15);
 expect(next.map(p=>p.text).join('')).toBe(original.map(p=>p.text).join(''));
 expect(next[0].title).toBe('My title');expect(next.find(p=>p.id==='next')?.title).toBe('Tomorrow');
 expect(next.every(p=>p.text.length<=15)).toBe(true);expect(paginateJournal(next,s=>s.length<=15)).toEqual(next);
});
it('does not reuse existing continuation identities when adding more writing',()=>{
 const p={id:'original',text:'one two three four',date:'2026-11-01T12:00:00Z'};
 const existing=[p,{...p,id:'original:continuation:1'}];
 const split=paginateJournal([p],s=>s.length<=10,existing);
 expect(split[1].id).not.toBe('original:continuation:1');
});
