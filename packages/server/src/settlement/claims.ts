/**
 * Phase 4 records that a recipient connection changed. There is no award or
 * transfer table yet, so claim resumption is intentionally a no-op until
 * Phase 6 adds authoritative committed awards and destination snapshots.
 */
export function retryClaims(ghId:string,connectionVersion:number):Promise<void> {
 if(!/^[1-9]\d*$/.test(ghId)||!Number.isSafeInteger(connectionVersion)||connectionVersion<1)return Promise.reject(new Error('Invalid claim-resume event'));
 return Promise.resolve();
}
