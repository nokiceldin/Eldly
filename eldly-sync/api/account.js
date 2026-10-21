import {neon} from '@neondatabase/serverless';
import {createAccountHandler} from '../server/account-service.js';
export default async function handler(req,res){
 if(!process.env.DATABASE_URL){res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Account service is not configured.'});}
 return createAccountHandler(neon(process.env.DATABASE_URL))(req,res);
}
