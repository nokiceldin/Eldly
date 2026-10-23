import {neon} from '@neondatabase/serverless';
import {createSocialService} from '../server/social-service.js';
import {createPushService,pushQueue} from '../server/push-service.js';
let service;
export default pushQueue.handleNodeCallback(async(message)=>{
 if(!service){const sql=neon(process.env.DATABASE_URL),social=createSocialService(sql);service=createPushService(sql,{ensure:social.ensure});}
 await service.processMessage(message);
},{retry:(_error,metadata)=>metadata.deliveryCount>10?{acknowledge:true}:{afterSeconds:Math.min(600,30*2**metadata.deliveryCount)}});
