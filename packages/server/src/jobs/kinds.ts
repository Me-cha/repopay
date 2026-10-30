import { z } from 'zod';
export const id = z.string().regex(/^[1-9]\d*$/).max(30);
const ref = { installationId: id, repoId: id, issueNumber: z.number().int().positive() };
export const workSchema = z.discriminatedUnion('kind', [
 z.object({ kind: z.literal('run_command'), ...ref, isPullRequest:z.boolean().optional(), commentId: id, actorId: id, command: z.discriminatedUnion('kind', [z.object({kind:z.literal('create'),amount:z.string().max(100)}),z.object({kind:z.literal('status')}),z.object({kind:z.literal('cancel')}),z.object({kind:z.literal('fund')}),z.object({kind:z.literal('approve'),issueNumber:z.number().int().positive().optional()}),z.object({kind:z.literal('reject'),reason:z.string().min(1).max(2000),issueNumber:z.number().int().positive().optional()}),z.object({kind:z.literal('link'),prNumber:z.number().int().positive()}),z.object({kind:z.literal('invalid')}),z.object({kind:z.literal('unavailable')})]) }),
 z.object({ kind: z.literal('create_bounty_from_label'), ...ref, actorId: id, amount: z.string().max(100), occurrence: z.string().max(256) }),
 z.object({ kind: z.literal('refresh_installation'), installationId: id, removedRepoIds: z.array(id).max(1000) }),
 z.object({ kind: z.literal('sync_bounty'), bountyId: id }),
 z.object({ kind: z.literal('reconcile_funding'), attemptId: id }),
 z.object({ kind: z.literal('retry_claims'), ghId:id, connectionVersion:z.number().int().positive() }),
 z.object({ kind: z.literal('sync_pull_request'), installationId:id, repoId:id, prNumber:z.number().int().positive() }),
 z.object({ kind: z.literal('refresh_verification_sha'), installationId:id, repoId:id, sha:z.string().regex(/^[a-f0-9]{40,64}$/i) }),
 z.object({ kind: z.literal('verify_submission'), submissionId:id, headSha:z.string().regex(/^[a-f0-9]{40,64}$/i), force:z.boolean().optional() }),
]);
export type Work = z.infer<typeof workSchema>;
export interface JobSpec { kind: Work['kind']; payload: Record<string, unknown>; dedupeKey: string; maxAttempts: number; runAfter?: Date }
export interface LeasedJob { id: string; kind: string; payload: Record<string, unknown>; leaseOwner: string; leaseToken: string; attempts: number; maxAttempts: number }
export function workFor(job: LeasedJob): Work { return workSchema.parse({ ...job.payload, kind: job.kind }); }
