import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { AuthError } from '../github/oauth.js';
import { currentAccess } from '../github/permissions.js';
import { githubId } from '../domain/types.js';
import { candidateScanner } from '../settlement/candidates.js';
import { createReviewService } from './approve.js';
export function createCommentReview(db:Database,github:GitHub,env:FundingEnv){
 return createReviewService(db,env,{scan:candidateScanner(db,github,env),authorize:()=>Promise.reject(new AuthError(403)),profileAccepted:()=>Promise.resolve(false),async authorizeComment(actorId,bounty){
  const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
  if(await github.permission(bounty.installationId,repo,actorId)!=='write')throw new AuthError(403,'Current write permission required.');
  return {actorGhId:githubId(actorId),source:'github_comment',authorization:{repoId:githubId(bounty.repoId),action:'review',role:'maintainer',checkedAt:new Date()}};
 }});
}
