// Read-only readiness probe while the replacement account service is staged.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'&&req.query?.action==='health')return res.status(200).json({ready:!!process.env.DATABASE_URL});
 return res.status(404).json({error:'Not available'});
}
