import {timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {createSocialService} from '../server/social-service.js';
import {createPushService,pushQueue,PUSH_TOPIC} from '../server/push-service.js';
let service;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET||''}`),supplied=Buffer.from(req.headers.authorization||'');
 if(!process.env.CRON_SECRET||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return res.status(401).json({error:'Unauthorized'});
 if(!service){const sql=neon(process.env.DATABASE_URL),social=createSocialService(sql);service=createPushService(sql,{ensure:social.ensure});}
 try{await service.repair();let probeMessageId;if(req.query?.probe==='1')probeMessageId=(await pushQueue.send(PUSH_TOPIC,{kind:'probe'},{retentionSeconds:300})).messageId;return res.status(200).json({ok:true,...(probeMessageId?{probeMessageId}:{})});}catch{return res.status(503).json({error:'Retry notification scheduling later.'});}
}
