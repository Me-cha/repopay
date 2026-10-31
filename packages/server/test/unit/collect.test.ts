import { afterEach,expect,it,vi } from 'vitest';
import { intentFixture } from '../helpers/funding.js';
import { linkPr } from '../../src/actions/link.js';
import { collectVerification } from '../../src/verifier/collect.js';
import type { PullRequest } from '../../src/github/app.js';
const pr=(head='a'.repeat(40)):PullRequest=>({id:'501',number:42,state:'open',draft:false,title:'Fix parser',body:'Implements validation',merged_at:null,closed_at:null,user:{id:'8',login:'contributor',type:'User'},head:{sha:head},base:{sha:'b'.repeat(40),repo:{id:'2'}}});
let f:Awaited<ReturnType<typeof intentFixture>>|undefined;
afterEach(async()=>{await f?.close();f=undefined;});
it('collects bounded diff, exact-SHA CI, and only the authenticated PR author as eligible',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());
 vi.mocked(f.api.pullRequest).mockResolvedValue(pr());vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n+return false'}],complete:true});
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'},{ghId:'9',login:'coauthor',type:'User'}],complete:true});
 vi.mocked(f.api.checkRuns).mockResolvedValue({runs:[{id:'11',name:'test',head_sha:'a'.repeat(40),status:'completed',conclusion:'success',app:{id:'15368'}}],complete:true});
 const repo=await f.api.repository('1','2');const collected=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)});
 expect(collected.diff).toContain('src/parser.ts');expect(collected.ci.status).toBe('pass');expect(collected.eligibleAuthors).toEqual([{ghId:'8',login:'contributor'}]);expect(collected.unverifiedAuthors).toEqual(['9']);expect(collected.sufficient).toBe(false);
});
it('flags null patches and capped pagination as truncated evidence',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:null}],complete:false});vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
 const repo=await f.api.repository('1','2');const collected=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)});expect(collected.truncated).toBe(true);expect(collected.sufficient).toBe(false);
});
it('caps pull-request descriptions and marks the evidence insufficient when truncated',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());
 const longBody='x'.repeat(8001);vi.mocked(f.api.pullRequest).mockResolvedValue({...pr(),body:longBody});
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'return false'}],complete:true});
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
 const repo=await f.api.repository('1','2');const collected=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)});
 expect(collected.prBody).toHaveLength(8000);expect(collected.truncated).toBe(true);expect(collected.sufficient).toBe(false);
});
it('rejects a head SHA change during collection rather than attributing old checks to new code',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr('d'.repeat(40)));const repo=await f.api.repository('1','2');
 await expect(collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)})).rejects.toThrow(/revision changed/);
 expect(f.api.pullRequestFiles).not.toHaveBeenCalled();
});
it('uses the funded diff limit even when runtime configuration later changes',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());
 vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'x'.repeat(500)}],complete:true});
 const repo=await f.api.repository('1','2');
 const terms=structuredClone(f.terms);terms.policy.maxDiffChars=100;
 const collected=await collectVerification({github:f.api,env:{...f.env,MAX_DIFF_CHARS:1000},installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms,expectedHeadSha:'a'.repeat(40)});
 expect(collected.diff).toHaveLength(100);expect(collected.truncated).toBe(true);expect(collected.sufficient).toBe(false);
});
it('does not treat filtered file changes as complete evidence alongside a visible fix',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'+validate(value)'},{filename:'vendor/parser.js',status:'modified',additions:1,deletions:1,patch:'-validate(value)\n+return true'}],complete:true});
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
 vi.mocked(f.api.checkRuns).mockResolvedValue({runs:[{id:'11',name:'test',head_sha:'a'.repeat(40),status:'completed',conclusion:'success',app:{id:'15368'}}],complete:true});
 const repo=await f.api.repository('1','2');const collected=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)});
 expect(collected.truncated).toBe(true);expect(collected.sufficient).toBe(false);
});

it('includes unchanged test lines at the exact head while preserving the original patch',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 const read=vi.fn().mockResolvedValue("test('unchanged array coverage', () => assert.equal(encode(['a','b']), 'x=a&x=b'));\n");
 Object.assign(f.api,{fileAtRevision:read});
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'demo-test/serializers.test.cjs',status:'modified',additions:1,deletions:1,patch:'-old formatting\n+new formatting',sha:'c'.repeat(40)}],complete:true});
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
 const repo=await f.api.repository('1','2');const collected=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)});
 expect(read).toHaveBeenCalledWith('1',repo,'demo-test/serializers.test.cjs','a'.repeat(40),'c'.repeat(40));
 expect(collected.diff).toContain('+new formatting');expect(collected.diff).toContain('unchanged array coverage');expect(collected.diff).toContain('not additional changes');expect(collected.truncated).toBe(false);
});

it.each(['unavailable','budget','too-many','missing-blob','oversize'])('holds incomplete test context: %s',async(mode)=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 const file={filename:'tests/parser.test.ts',status:'modified',additions:1,deletions:0,patch:'+fix',sha:'c'.repeat(40)};
 const read=vi.fn().mockImplementation(()=>mode==='unavailable'?Promise.reject(new Error('access lost')):Promise.resolve('x'.repeat(mode==='oversize'?16385:200)));
 Object.assign(f.api,{fileAtRevision:read});
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:mode==='too-many'?Array.from({length:5},(_,i)=>({...file,filename:`tests/${String(i)}.ts`})):[mode==='missing-blob'?{...file,sha:undefined}:file],complete:true});
 const repo=await f.api.repository('1','2');const terms=structuredClone(f.terms);if(mode==='budget')terms.policy.maxDiffChars=100;
 const evidence=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms,expectedHeadSha:'a'.repeat(40)});
 expect(evidence.truncated).toBe(true);expect(evidence.sufficient).toBe(false);expect(read.mock.calls.length).toBeLessThanOrEqual(4);expect(evidence.diff.length).toBeLessThanOrEqual(terms.policy.maxDiffChars);
});
it('rejects revision movement during full-context reads',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValueOnce(pr()).mockResolvedValueOnce(pr('d'.repeat(40)));
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'test/a.js',status:'modified',additions:1,deletions:0,patch:'+test',sha:'c'.repeat(40)}],complete:true});
 vi.mocked(f.api.fileAtRevision).mockResolvedValue('test();');const repo=await f.api.repository('1','2');
 await expect(collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)})).rejects.toThrow('changed while collecting');
});

it('includes unchanged scalar implementation and tests alongside the array-only patch',async()=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 const source="if (value === null || value === undefined) continue;\nfor (const item of values) { if (item == null) continue; encode(item); }";
 const tests="test('scalar null omission and retained zero false', () => {});";
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'lib/serializer.js',status:'modified',additions:1,deletions:0,patch:'+if (item == null) continue;',sha:'c'.repeat(40)},{filename:'test/serializer.test.js',status:'modified',additions:1,deletions:0,patch:'+arrayTest();',sha:'d'.repeat(40)}],complete:true});
 vi.mocked(f.api.fileAtRevision).mockImplementation((_inst,_repo,path)=>Promise.resolve(path.startsWith('lib/')?source:tests));
 const repo=await f.api.repository('1','2');const evidence=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms:f.terms,expectedHeadSha:'a'.repeat(40)});
 expect(evidence.diff).toContain('value === null');expect(evidence.diff).toContain('scalar null omission');expect(evidence.diff).toContain('+if (item == null) continue;');expect(evidence.truncated).toBe(false);
});

it.each(['unavailable','budget','too-many','missing-blob','oversize'])('holds incomplete source context: %s',async(mode)=>{
 f=await intentFixture();const linked=await linkPr(f.database,f.bounty,pr());vi.mocked(f.api.pullRequest).mockResolvedValue(pr());
 const file={filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'+fix',sha:'c'.repeat(40)};
 const read=vi.fn().mockImplementation(()=>mode==='unavailable'?Promise.reject(new Error('access lost')):Promise.resolve('x'.repeat(mode==='oversize'?16385:200)));
 Object.assign(f.api,{fileAtRevision:read});
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:mode==='too-many'?Array.from({length:5},(_,i)=>({...file,filename:`src/${String(i)}.ts`})):[mode==='missing-blob'?{...file,sha:undefined}:file],complete:true});
 const repo=await f.api.repository('1','2');const terms=structuredClone(f.terms);if(mode==='budget')terms.policy.maxDiffChars=100;
 const evidence=await collectVerification({github:f.api,env:f.env,installationId:'1',repo,bounty:f.bounty,submission:linked.submission,terms,expectedHeadSha:'a'.repeat(40)});
 expect(evidence.truncated).toBe(true);expect(evidence.sufficient).toBe(false);expect(read.mock.calls.length).toBeLessThanOrEqual(4);expect(evidence.diff.length).toBeLessThanOrEqual(terms.policy.maxDiffChars);
});
