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
