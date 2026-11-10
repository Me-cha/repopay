import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Keypair } from '@solana/web3.js';
// Creates only a local devnet test key; never requests funds or broadcasts.
const directory=resolve('.local/pyusd'),path=resolve(directory,'treasury.json');
try {
 await mkdir(directory,{recursive:true,mode:0o700});
 const key=Keypair.generate();
 await writeFile(path,JSON.stringify(Array.from(key.secretKey))+'\n',{flag:'wx',mode:0o600});
 console.log('Devnet treasury created. Address: '+key.publicKey.toBase58());
 console.log('Set PYUSD_TREASURY_KEY_FILE='+path);
}catch {console.error('Devnet treasury was not created. An existing key will not be overwritten; check the local directory.');process.exitCode=1;}
