import { z } from 'zod';
export const id = z.string().regex(/^[1-9]\d*$/).max(30);
const ref = { installationId: id, repoId: id, issueNumber: z.number().int().positive() };
export const workSchema = z.discriminatedUnion('kind', [
 z.object({ kind: z.literal('run_command'), ...ref, commentId: id, actorId: id, command: z.discriminatedUnion('kind', [z.object({kind:z.literal('create'),amount:z.string().max(100)}),z.object({kind:z.literal('status')}),z.object({kind:z.literal('invalid')}),z.object({kind:z.literal('unavailable')})]) }),
 z.object({ kind: z.literal('create_bounty_from_label'), ...ref, actorId: id, amount: z.string().max(100), occurrence: z.string().max(256) }),
 z.object({ kind: z.literal('refresh_installation'), installationId: id, removedRepoIds: z.array(id).max(1000) }),
 z.object({ kind: z.literal('sync_bounty'), bountyId: id }),
]);
export type Work = z.infer<typeof workSchema>;
export interface JobSpec { kind: Work['kind']; payload: Record<string, unknown>; dedupeKey: string; maxAttempts: number; runAfter?: Date }
export interface LeasedJob { id: string; kind: string; payload: Record<string, unknown>; leaseOwner: string; leaseToken: string; attempts: number; maxAttempts: number }
export function workFor(job: LeasedJob): Work { return workSchema.parse({ ...job.payload, kind: job.kind }); }
