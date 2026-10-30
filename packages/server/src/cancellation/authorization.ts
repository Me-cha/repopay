import { AuthError } from '../github/oauth.js';
export function evidenceLinks(values:string[],repo:string):string[]{
 if(!values.length||values.length>10)throw new AuthError(400,'Supply one to ten repository evidence links.');
 return values.map(value=>{const u=new URL(value);if(u.origin!=='https://github.com'||u.username||u.password||u.search||u.hash||!u.pathname.startsWith('/'+repo+'/')||!/^\/(issues|pull)\/[1-9]\d*$|^\/commit\/[a-f0-9]{40}$/i.test(u.pathname.slice(repo.length+1)))throw new AuthError(400,'Use exact issue, PR or commit links in this repository.');return u.href;});
}
export function assertIndependent(actor:string,operators:string[],conflicts:string[]){
 if(!operators.includes(actor)||conflicts.includes(actor))throw new AuthError(403,'An independent allowlisted operator is required.');
}
