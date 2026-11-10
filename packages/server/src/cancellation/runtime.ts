import { chainService } from '../solana/service.js';
import { createChainProvider } from '../solana/provider.js';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { AuthError } from '../github/oauth.js';
import { cancellationCollector } from './evidence.js';
import { createCancellation } from './service.js';
import { createOrders } from '../paypal/orders.js';
import { createRefunds } from '../paypal/refunds.js';
import { createRefundSettlement } from '../settlement/refund.js';
export function createPhase8(db:Database,github:GitHub,env:FundingEnv){
 const cancellation=createCancellation(db,env,{github,collect:cancellationCollector(db,github,env.MAX_DIFF_CHARS),async access(actor,b,write){const {repo}=await currentAccess(github,b.installationId,b.repoId),p=await github.permission(b.installationId,repo,actor);if(p==='none'||(write&&p!=='write'))throw new AuthError(403,'Current repository access is required.');}});
 return {cancellation,refunds:createRefundSettlement(db,env,cancellation,createOrders(env),createRefunds(env),chainService(db,env,createChainProvider(env),()=>new Date(),cancellation))};
}
