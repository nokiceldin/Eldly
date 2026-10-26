import {scopedKey} from './accountScope';
const KEY='device-diagnostics-v1';
export type Diagnostic={at:string;kind:string;reference?:string};
export function diagnostics():Diagnostic[]{try{return JSON.parse(localStorage.getItem(scopedKey(KEY))||'[]');}catch{return [];}}
export function recordDiagnostic(kind:'cloud'|'app',reference?:string){try{const rows=[...diagnostics(),{at:new Date().toISOString(),kind,...(reference&&/^[a-z0-9-]{1,80}$/i.test(reference)?{reference}:{})}].slice(-20);localStorage.setItem(scopedKey(KEY),JSON.stringify(rows));}catch{}}
