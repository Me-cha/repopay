import type { FundingEnv } from '../env.js';
import { PublicKey } from '@solana/web3.js';
// Official devnet PYUSD mint: https://solana.com/pyusd . Never accept a client mint/network.
export const PYUSD_MINT='CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM';
export const DEVNET_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEVNET_RPC='https://api.devnet.solana.com';
export function publicWallet(value:string):string {
 const key=new PublicKey(value);
 if(key.toBase58()!==value||!PublicKey.isOnCurve(key.toBytes()))throw new Error('A signing Solana wallet is required');
 return value;
}
// Existing allocation uses hundredths; a PYUSD hundredth is exactly 10,000 atomic units.
export function atomicAmount(hundredths:number):bigint {
 if(!Number.isSafeInteger(hundredths)||hundredths<=0||hundredths>2147483647)throw new Error('Invalid PYUSD amount');
 return BigInt(hundredths)*10000n;
}
export function enabled(env:FundingEnv):void {
 if(!env.PYUSD_DEVNET_ENABLED||!env.PYUSD_TREASURY_KEY_FILE)throw new Error('PYUSD devnet is not configured');
}
