import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {setAccountScope,scopedKey} from './accountScope';
import {defaultBook,readBook,readJournalPages,readJournalPosition} from './journal';
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});setAccountScope('guest');});
afterEach(()=>{vi.unstubAllGlobals();setAccountScope(null as unknown as string);});
it('preserves existing writing when titles are introduced',()=>{const pages=[{text:'Existing entry',date:'2026-10-31T12:00:00Z'},{text:'Second page',date:'2026-10-31T12:00:00Z'}];localStorage.setItem(scopedKey('journal:v1'),JSON.stringify(pages));expect(readJournalPages(scopedKey('journal:v1'))).toEqual(pages);});
it('bounds a stale bookmark to the available pages',()=>{localStorage.setItem(scopedKey('journal:position:v1'),'99');expect(readJournalPosition(6)).toBe(5);localStorage.setItem(scopedKey('journal:position:v1'),'-2');expect(readJournalPosition(6)).toBe(0);});
it('keeps book designs and bookmarks separate per account',()=>{localStorage.setItem(scopedKey('journal:design:v1'),JSON.stringify({...defaultBook,title:'My quiet book',color:'plum'}));localStorage.setItem(scopedKey('journal:position:v1'),'4');expect(readBook().title).toBe('My quiet book');setAccountScope('another');expect(readBook()).toEqual(defaultBook);expect(readJournalPosition(10)).toBe(0);});
it('rejects invalid page data and handles unavailable storage',()=>{localStorage.setItem(scopedKey('journal:v1'),'[{}]');expect(readJournalPages(scopedKey('journal:v1'))).toHaveLength(2);vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');}});expect(readBook()).toEqual(defaultBook);expect(readJournalPosition(10)).toBe(0);expect(readJournalPages('journal')).toHaveLength(2);});
it('keeps five or six blank pages without removing writing or titles',async()=>{const {withJournalBuffer,newJournalPage}=await import('./journal');expect(withJournalBuffer([newJournalPage()])).toHaveLength(6);const pages=Array.from({length:30},newJournalPage);pages[2].text='Keep this';pages[4].title='A title';const buffered=withJournalBuffer(pages);expect(buffered).toHaveLength(10);expect(buffered[2].text).toBe('Keep this');expect(buffered[4].title).toBe('A title');buffered[9].text='Continue';expect(withJournalBuffer(buffered)).toHaveLength(16);});

it.each([{title:'My entry'}, {text:'My entry'}])('records the first writing date for %j', async patch=>{
  const {editJournalPage,hasJournalDate}=await import('./journal');
  const blank={text:'',date:'2026-11-01T12:00:00Z'};
  const first='2026-11-04T12:00:00Z';
  const later='2026-11-05T12:00:00Z';
  const whitespace=editJournalPage(blank,{text:'  '},first);
  expect(hasJournalDate(whitespace)).toBe(false);
  const written=editJournalPage(whitespace,patch,first);
  expect(hasJournalDate(written)).toBe(true);
  expect(written.date).toBe(first);
  const cleared=editJournalPage(written,{title:'',text:''},later);
  expect(editJournalPage(cleared,patch,later).date).toBe(first);
  expect(editJournalPage({...blank,text:'Older entry'},patch,later).date).toBe(blank.date);
});
