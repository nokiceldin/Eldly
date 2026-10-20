import { isPersonalOwner, scopedKey } from '../accountScope';
import { cloudNamespace } from './client';
import { snapshot,restore,validateSnapshot } from './local';
import { apply,flatten,inflate,type Change } from './records';
/** Recover only unsent edits, only into the administrator-designated legacy owner. */
export function recoverLegacyPending(){
 if(!isPersonalOwner()||localStorage.getItem(scopedKey('legacy-pending-recovered')))return;
 const raw=localStorage.getItem(`eldly-shared-sync-v2:${cloudNamespace}`);
 if(raw){const legacy=JSON.parse(raw);const pending:Change[]=Array.isArray(legacy.pending)?legacy.pending:[];
  if(pending.length){
   const decoded=inflate(apply(flatten(snapshot()),pending));
   if(!validateSnapshot(decoded))throw Error('Old offline edits need recovery. The original device copy is preserved.');
   restore(decoded);
  }
 }
 localStorage.setItem(scopedKey('legacy-pending-recovered'),'1');
}
