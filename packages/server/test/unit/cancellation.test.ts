import { describe,it,expect } from 'vitest';
import { evidenceLinks,assertIndependent } from '../../src/cancellation/authorization.js';
describe('cancellation boundaries',()=>{
 it('rejects arbitrary external URLs and cross-repository links',()=>{
  expect(()=>evidenceLinks(['https://localhost/secrets'],'owner/repo')).toThrow();
  expect(()=>evidenceLinks(['https://github.com/other/repo/pull/1'],'owner/repo')).toThrow();
  expect(evidenceLinks(['https://github.com/owner/repo/pull/1'],'owner/repo')).toHaveLength(1);
 });
 it('denies self-review, mere writers and all claimant identities',()=>{
  for(const actor of ['4','8','9'])expect(()=>{assertIndependent(actor,['4','8'],['4','8','9']);}).toThrow();
  expect(()=>{assertIndependent('10',['10'],['4','8']);}).not.toThrow();
 });
});
