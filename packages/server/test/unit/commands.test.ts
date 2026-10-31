import { expect, it } from 'vitest';
import { parseCommand, parseUsd, parseLabel } from '../../src/github/commands.js';
it('parses exact cents and first nonquoted noncode line', () => {
 expect(parseUsd('50',10000)).toBe(5000); expect(parseUsd('0.01',10000)).toBe(1);
 expect(parseCommand('> /bounty create 99\n```\n/bounty create 2\n```\n/bounty create 50')).toEqual({kind:'create', amount:'50'});
 expect(parseCommand('hello\n/bounty create 50')).toBeNull();
 expect(parseCommand('    /bounty create 50')).toBeNull();
 expect(parseCommand('/bounty link 42')).toEqual({kind:'link',prNumber:42});
 expect(parseCommand('/bounty link 0')).toEqual({kind:'unavailable'});
 expect(parseLabel('bounty:$50.00')).toBe('50.00');
});
it.each(['-1','0','1.001','1e2','NaN','Infinity','10000000','1.2x'])('rejects invalid amount %s', value => { expect(() => parseUsd(value,10000)).toThrow(); });

it('review commands bind optional issue identity and require a rejection reason',()=>{
 expect(parseCommand('/bounty approve #12')).toEqual({kind:'approve',issueNumber:12});
 expect(parseCommand('/bounty reject #12 Missing required behavior')).toEqual({kind:'reject',issueNumber:12,reason:'Missing required behavior'});
 expect(parseCommand('/bounty reject')).toEqual({kind:'unavailable'});
});
it('contribution commands require explicit complete revisions and a separate named confirmation',()=>{
 const head='a'.repeat(40),base='b'.repeat(40),reason='Implemented array validation';
 expect(parseCommand(`/bounty contribute #11 ${head} ${base} ${reason}`)).toEqual({kind:'contribute',issueNumber:11,headSha:head,baseSha:base,reason});
 expect(parseCommand(`/bounty confirm-contributor @second ${head} ${base} ${reason}`)).toEqual({kind:'confirm-contributor',login:'second',headSha:head,baseSha:base,reason});
 for(const text of [`/bounty contribute ${head.slice(0,7)} ${base} ${reason}`,`/bounty contribute @second ${head} ${base} ${reason}`,`/bounty confirm-contributor ${head} ${base} ${reason}`])expect(parseCommand(text)?.kind).toBe('invalid');
 expect(parseCommand(`> /bounty contribute ${head} ${base} ${reason}`)).toBeNull();
});

it('parses PR retry and issue-scoped status without accepting partial or malformed revision bindings',()=>{
 expect(parseCommand('/bounty retry')).toEqual({kind:'retry'});
 expect(parseCommand('/bounty retry #11')).toEqual({kind:'retry',issueNumber:11});
 expect(parseCommand(`/bounty retry #11 ${'a'.repeat(40)} ${'b'.repeat(40)}`)).toEqual({kind:'retry',issueNumber:11,headSha:'a'.repeat(40),baseSha:'b'.repeat(40)});
 expect(parseCommand('/bounty retry #11 bad')).not.toMatchObject({kind:'retry'});
 expect(parseCommand('/bounty status #11')).toEqual({kind:'status',issueNumber:11});
 expect(parseCommand('> /bounty retry')).toBeNull();
});
