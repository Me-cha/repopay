import nock from 'nock';
import { afterAll, afterEach, beforeAll } from 'vitest';
beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect(/^(127\.0\.0\.1|localhost)(:\d+)?$/);
});
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  if (pending.length) throw new Error('Unconsumed provider mocks: ' + pending.join(', '));
});
afterAll(() => { nock.enableNetConnect(); });
