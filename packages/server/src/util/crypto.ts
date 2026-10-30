import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value:string) => createHash('sha256').update(value).digest('hex');
export const mac = (secret:string,value:string) => createHmac('sha256',secret).update(value).digest('base64url');
export function equalSecret(a:string,b:string):boolean {
 const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y);
}
export function encrypt(value:string,key:string,context:string):string {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);
 cipher.setAAD(Buffer.from(context));const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
}
export function decrypt(value:string,key:string,context:string):string {
 const [version,iv,tag,data,...rest]=value.split('.');
 if(version!=='v1'||!iv||!tag||!data||rest.length)throw new Error('Invalid encrypted value');
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(iv,'base64url'));
 decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');
}
