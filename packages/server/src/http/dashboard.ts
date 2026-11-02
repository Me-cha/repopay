import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express,{ type Express,type Request,type Response } from 'express';
import { AuthError } from '../github/oauth.js';
import { requireSession } from './session.js';
import { htmlPage,safeError,signInRedirect,type AuthenticationDependencies } from './auth.js';
/**
 * Serves the React web app and enforces its route guards on the server.
 *
 *  /                 public   sign-in; a valid session is sent to /dashboard
 *  /dashboard[/...]  private  overview and PR detail routes; no session -> /
 *
 * The browser guard in packages/web mirrors this, but the server decision is
 * authoritative: private HTML is never sent without a verified session.
 */
export function mountDashboard(app:Express,deps:AuthenticationDependencies){
 // Both src/http and dist/http live three levels below packages/web.
 const directory=fileURLToPath(new URL('../../../web/dist/',import.meta.url));
 app.use('/dashboard/assets',express.static(directory+'assets',{index:false,fallthrough:false,maxAge:0}));
 const shell=(res:Response)=>{
  if(!existsSync(directory+'index.html')){res.status(503).type('html').send(htmlPage('App unavailable','<p>The web build is not available yet. Run the web build and reload.</p>'));return;}
  res.sendFile(directory+'index.html');
 };
 app.get('/',async(req:Request,res:Response)=>{
  try{await requireSession(deps.auth,req);res.redirect(303,'/dashboard');}
  // Any session failure (absent, expired, provider unavailable) shows sign-in.
  catch{shell(res);}
 });
 app.get(/^\/dashboard(?:\/(?!assets\/).*)?$/,async(req:Request,res:Response)=>{
  try{await requireSession(deps.auth,req);shell(res);}
  catch(error){if(error instanceof AuthError&&error.status===401){signInRedirect(res);return;}safeError(res,error,req.path);}
 });
}
