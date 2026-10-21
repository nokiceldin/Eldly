// Read-only account-content smoke check. Credentials arrive on stdin, never in source.
import {readFileSync} from 'node:fs';import {neon} from '@neondatabase/serverless';import {createAccountHandler} from './account-service.js';
let input='';for await(const part of process.stdin)input+=part;
const handler=createAccountHandler(neon((process.env.DATABASE_URL||readFileSync('/tmp/myspace-neon-url','utf8').trim())));
for(const credentials of JSON.parse(input)){
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(data){this.data=data;return this;}});
 const headers={host:'app.test',origin:'https://app.test','x-forwarded-for':'qa-check'};
 const login=response();await handler({method:'POST',query:{action:'login'},headers,body:credentials},login);
 if(login.code!==200)throw Error('Login failed for '+credentials.email);
 const cookie=login.headers['Set-Cookie'].split(';')[0],pull=response();
 await handler({method:'POST',query:{action:'rpc'},headers:{...headers,cookie},body:{name:'eldinos_account_pull',args:{after_revision:0}}},pull);
 if(pull.code!==200||!pull.data.data.initialized)throw Error('Account pull failed');
 console.log(JSON.stringify({username:login.data.user.app_metadata.username,login:true,records:pull.data.data.records.length,revision:pull.data.data.revision}));
 const logout=response();await handler({method:'POST',query:{action:'logout'},headers:{...headers,cookie},body:{}},logout);
 if(logout.code!==200)throw Error('Logout failed');
}
