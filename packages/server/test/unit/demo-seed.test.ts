import { expect, it } from 'vitest';
import { DEMO_REPO, seedDemo } from '../../scripts/demo-seed.js';

it('dry run needs no credentials or provider calls', async () => {
  const lines: string[] = [];
  await seedDemo([], () => Promise.reject(new Error('must not call GitHub')), (line) => lines.push(line));
  expect(lines.join('\n')).toContain('DRY RUN');
  expect(lines.join('\n')).not.toContain('/bounty create');
});
it('rejects wrong repository, missing confirmation and unknown arguments before access', async () => {
  for (const args of [['--execute'], ['--execute', '--repo', 'paypal/paypalhttp'], ['--unknown'], ['--execute', '--repo', DEMO_REPO, '--confirm-repo', 'Me-cha/repopay']]) {
    await expect(seedDemo(args, () => Promise.reject(new Error('unexpected provider call')), () => undefined)).rejects.toThrow(/arguments|confirm|repository/);
  }
});
it('creates fresh issues on every explicit run without labels, commands, merges or payments', async () => {
  let issue = 10;
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    if (args[0] === 'repo') return Promise.resolve(JSON.stringify({ nameWithOwner: DEMO_REPO, isFork: false }));
    return Promise.resolve(`https://github.com/${DEMO_REPO}/issues/${String(++issue)}\n`);
  };
  const lines: string[] = [];
  for (let i = 0; i < 2; i++) await seedDemo(['--execute', '--repo', DEMO_REPO, '--confirm-repo', DEMO_REPO], run, (line) => lines.push(line));
  expect(issue).toBe(14);
  expect(calls.filter((args) => args[0] === 'issue')).toHaveLength(4);
  expect(calls.every((args) => args[0] === 'repo' || (args[0] === 'issue' && args[1] === 'create'))).toBe(true);
  expect(calls.flat()).not.toContain('--label');
  expect(new Set(lines.filter((line) => line.startsWith('https://'))).size).toBe(4);
});
it('refuses forks and stops after an ambiguous create without retrying', async () => {
  const args = ['--execute', '--repo', DEMO_REPO, '--confirm-repo', DEMO_REPO];
  await expect(seedDemo(args, () => Promise.resolve(JSON.stringify({ nameWithOwner: DEMO_REPO, isFork: true })), () => undefined)).rejects.toThrow('detached');
  let writes = 0;
  await expect(seedDemo(args, (command) => {
    if (command[0] === 'repo') return Promise.resolve(JSON.stringify({ nameWithOwner: DEMO_REPO, isFork: false }));
    writes++;
    return Promise.resolve('unexpected response');
  }, () => undefined)).rejects.toThrow('Inspect');
  expect(writes).toBe(1);
});
