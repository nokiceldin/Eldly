// Owners define the activity; a partner controls monetary amounts only.
export function partnerAmounts(rule, approved){
 return {...rule,amount:approved?.amount??0,...(rule.secondary?{secondary:{...rule.secondary,amount:approved?.secondary?.amount??0}}:{})};
}
export function ownerRulesForWeek(raw,approved,week,rule){
 if(!raw?.rulesFrom||week<raw.rulesFrom)return approved;
 const kind=[...(raw.kindHistory||[])].filter(p=>p.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0]?.kind||raw.kind;
 return {...raw,kind,xp:partnerAmounts(rule||raw.xp||{amount:0,basis:'entry'},approved?.xp)};
}
