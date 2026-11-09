import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';

const close = (server: Server) => new Promise<void>(resolve => { server.close(() => { resolve(); }); });

it.each(['register', 'run'])('starts the real Render SDK once in %s mode with default auto-start', async mode => {
  const directory = await mkdtemp('/tmp/repopay-sdk-');
  const socket = `${directory}/runtime.sock`;
  let registrations = 0, inputs = 0, callbacks = 0, claims = 0;
  const broker = createServer((_req, res) => {
    claims++;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ownerToken: null }));
  });
  const daemon = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.startsWith('/input')) {
      inputs++;
      res.end(JSON.stringify({ task_name: 'verifySubmission', task_run_id: 'trn-runtime-test', input: Buffer.from(JSON.stringify([{ dispatchId: randomUUID() }])).toString('base64') }));
    } else {
      if (req.url === '/register-tasks') registrations++;
      if (req.url === '/callback') callbacks++;
      req.resume();
      req.on('end', () => res.end('{}'));
    }
  });
  try {
    await new Promise<void>(resolve => broker.listen(0, '127.0.0.1', resolve));
    await new Promise<void>(resolve => daemon.listen(socket, resolve));
    const address = broker.address();
    if (!address || typeof address === 'string') throw new Error('Broker address missing');
    // Deliberately omit AUTO_START, like a real Render container. No parent secrets.
    const child = spawn(process.execPath, ['--import', 'tsx', 'packages/server/src/review-workflow.ts'], {
      env: { PATH: process.env.PATH, RENDER_SDK_MODE: mode, RENDER_SDK_SOCKET_PATH: socket,
        PUBLIC_URL: `http://127.0.0.1:${String(address.port)}`, REVIEW_BACKEND: 'render',
        REVIEW_GENERATION: '2', REVIEW_EXECUTOR_KEY: Buffer.alloc(32, 1).toString('base64') },
      stdio: 'ignore',
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject); child.once('close', resolve);
    }).finally(() => { clearTimeout(timer); });
    expect(code).toBe(0);
    expect({ registrations, inputs, callbacks, claims }).toEqual(mode === 'register'
      ? { registrations: 1, inputs: 0, callbacks: 0, claims: 0 }
      : { registrations: 0, inputs: 1, callbacks: 1, claims: 1 });
  } finally {
    await close(daemon); await close(broker); await rm(directory, { recursive: true, force: true });
  }
});
