import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

export const DEMO_REPO = 'deepakA18/repopay-demo-http';
type Run = (args: string[], body?: string) => Promise<string>;
const repository = z.object({ nameWithOwner: z.literal(DEMO_REPO), isFork: z.literal(false) });

/** Creates ordinary unfunded issues only. Never loads application credentials or touches its DB. */
export async function seedDemo(args: string[], run: Run, print: (line: string) => void): Promise<void> {
  const execute = args.includes('--execute');
  if (args.length && (!execute || args.length !== 5 || args[0] !== '--execute' || args[1] !== '--repo' || args[3] !== '--confirm-repo')) {
    throw new Error('Invalid arguments: use --execute --repo OWNER/REPO --confirm-repo OWNER/REPO, or no arguments for dry run.');
  }
  if (execute && (args[2] !== DEMO_REPO || args[4] !== DEMO_REPO)) throw new Error('The designated repository and confirmation must both match ' + DEMO_REPO);
  const runId = randomUUID();
  const issues = [
    { title: 'Serializer regression walkthrough', body: 'Document a reproducible serializer edge case, expected output and executable regression test before funding. A contributor must implement and test the agreed fix; an empty or unrelated PR is not a solution.' },
    { title: 'Independent review walkthrough', body: 'Prepare a separate reproducible issue with explicit acceptance criteria for a partial-solution/manual-review scenario. Agree the criteria before funding; preserve all submitted work and review history.' },
  ];
  if (!execute) {
    print('DRY RUN: two ordinary unfunded issues in ' + DEMO_REPO + '. No provider calls.');
    for (const issue of issues) print(issue.title + '\n' + issue.body);
    return;
  }
  const repo: unknown = JSON.parse(await run(['repo', 'view', DEMO_REPO, '--json', 'nameWithOwner,isFork']));
  if (!repository.safeParse(repo).success) throw new Error('Expected the designated detached demo repository; no issues created.');
  for (const issue of issues) {
    try {
      const url = (await run(['issue', 'create', '--repo', DEMO_REPO, '--title', `[Repopay sandbox ${runId}] ${issue.title}`, '--body-file', '-'], `${issue.body}\n\nSandbox walkthrough preparation only. No bounty or payment has been created. Replace these preparation notes with precise agreed criteria before creating a bounty.`)).trim();
      if (!/^https:\/\/github\.com\/deepakA18\/repopay-demo-http\/issues\/[1-9]\d*$/.test(url)) throw new Error('Unrecognized issue response');
      print(url);
    } catch {
      throw new Error('Issue creation outcome may be unknown. Inspect the demo repository before rerunning; no automatic retry was made.');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void seedDemo(process.argv.slice(2), (args, body) => new Promise<string>((resolve, reject) => {
    const child = execFile('gh', args, {
      timeout: 30_000, maxBuffer: 64 * 1024,
      env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' },
    }, (error, stdout) => { if (error) reject(new Error('GitHub CLI command failed')); else resolve(stdout); });
    child.stdin?.on('error', () => { /* Exit callback reports command failure without echoing input. */ });
    child.stdin?.end(body ?? '');
  }), (line) => { console.log(line); }).catch((error: unknown) => {
    // Never echo provider stderr, headers or credentials.
    console.error(error instanceof Error && /^(Invalid arguments|The designated|Expected the designated|Issue creation outcome)/.test(error.message) ? error.message : 'Demo setup failed. Check local GitHub CLI authentication and repository access.');
    process.exitCode = 1;
  });
}
