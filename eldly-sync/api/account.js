import {neon} from '@neondatabase/serverless';
import {createAccountHandler} from '../server/account-service.js';
let accountHandler;
export default async function handler(req,res){
 if(!process.env.DATABASE_URL){res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Account service is not configured.'});}
 accountHandler ||= createAccountHandler(neon(process.env.DATABASE_URL));
 return accountHandler(req,res);
}
