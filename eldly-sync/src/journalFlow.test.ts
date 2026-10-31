import {expect,it} from 'vitest';
import {pageBreak} from './journalFlow';
it('moves the whole following word while preserving all characters',()=>{const text='A quiet moment to write';const cut=pageBreak(text,s=>s.length<=17);expect(text.slice(0,cut)).toBe('A quiet moment ');expect(text.slice(cut)).toBe('to write');expect(text.slice(0,cut)+text.slice(cut)).toBe(text);});
it('preserves paragraphs and supports long words',()=>{expect(pageBreak('first\nsecond',s=>s.length<=8)).toBe(6);expect(pageBreak('abcdefghijk',s=>s.length<=5)).toBe(5);});
it('keeps fitting text on the current page',()=>{expect(pageBreak('a full line',()=>true)).toBe(11);});
