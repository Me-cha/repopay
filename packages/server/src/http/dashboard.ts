import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express,{ type Express } from 'express';
import { htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
export function mountDashboard(app:Express,deps:AuthenticationDependencies){
 // Both src/http and dist/http live three levels below packages/web.
 const directory=fileURLToPath(new URL('../../../web/dist/',import.meta.url));
 app.use('/dashboard/assets',express.static(directory+'assets',{index:false,fallthrough:false,maxAge:0}));
 for(const route of ['/dashboard','/dashboard/'])app.get(route,async(req,res)=>{try{const s=await pageSession(deps,req,res);if(!s)return;if(!existsSync(directory+'index.html')){res.status(503).type('html').send(htmlPage('Dashboard unavailable','<p>The dashboard build is not available yet. Return to your GitHub issue or status page.</p>'));return;}res.sendFile(directory+'index.html');}catch(e){safeError(res,e,req.path);}});
}
