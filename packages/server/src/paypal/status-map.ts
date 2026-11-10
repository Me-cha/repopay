// Event names only route reconciliation; they are never financial status evidence.
export function fundingEvent(type:string):boolean {
 return type==='CHECKOUT.ORDER.DECLINED'||type==='CHECKOUT.ORDER.APPROVED'||type==='CHECKOUT.PAYMENT-APPROVAL.REVERSED'||type.startsWith('PAYMENT.CAPTURE.');
}
