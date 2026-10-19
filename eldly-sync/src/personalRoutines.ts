import { type Data, type Routine } from "./engine";
const requests = [
  { id:"personal-back-exercises-v1",title:"Back exercises",weekdays:[0,4] },
  { id:"personal-face-routine-v1",title:"Face routine",weekdays:[0,4] },
  { id:"personal-vacuuming-v1",title:"Vacuuming",weekdays:[6] },
  { id:"personal-trash-v1",title:"Throwing out the trash",weekdays:[6] },
];
/** One-time requested routines; a later deletion or edit must remain respected. */
export function addRequestedRoutines(data:Data):Data {
  if(data.personalRoutinesVersion===1)return data;
  const additions:Routine[]=requests.filter(request=>!data.routines.some(r=>r.id===request.id||r.title.trim().toLowerCase()===request.title.toLowerCase())).map(request=>({...request,category:"",notes:"",start:"2026-10-19",frequency:"weekly",interval:1,paused:false,carry:true,important:false}));
  return {...data,personalRoutinesVersion:1,routines:[...data.routines,...additions]};
}
