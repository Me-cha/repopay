import type { GitHub, Repository, Installation } from './app.js';
export async function currentAccess(github: GitHub, installationId:string,repoId:string):Promise<{installation:Installation;repo:Repository}> {
 const installation=await github.installation(installationId);
 if(!installation||installation.suspended_at)throw new Error('App access unavailable');
 const repo=await github.repository(installationId,repoId);return {installation,repo};
}
