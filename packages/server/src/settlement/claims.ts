/** Validates the durable claim event before the Phase 6 payout service resumes committed awards. */
export function retryClaims(ghId:string,connectionVersion:number):Promise<void> {
 if(!/^[1-9]\d*$/.test(ghId)||!Number.isSafeInteger(connectionVersion)||connectionVersion<1)return Promise.reject(new Error('Invalid claim-resume event'));
 return Promise.resolve();
}
