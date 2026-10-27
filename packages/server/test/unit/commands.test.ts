import { expect, it } from 'vitest';
import { parseCommand, parseUsd, parseLabel } from '../../src/github/commands.js';
it('parses exact cents and first nonquoted noncode line', () => {
 expect(parseUsd('50',10000)).toBe(5000); expect(parseUsd('0.01',10000)).toBe(1);
 expect(parseCommand('> /bounty create 99\n```\n/bounty create 2\n```\n/bounty create 50')).toEqual({kind:'create', amount:'50'});
 expect(parseCommand('hello\n/bounty create 50')).toBeNull();
 expect(parseCommand('    /bounty create 50')).toBeNull();
 expect(parseLabel('bounty:$50.00')).toBe('50.00');
});
it.each(['-1','0','1.001','1e2','NaN','Infinity','10000000','1.2x'])('rejects invalid amount %s', value => { expect(() => parseUsd(value,10000)).toThrow(); });
