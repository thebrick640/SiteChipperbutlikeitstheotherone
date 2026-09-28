const { test } = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../js/auth-session.mjs');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function setup(overrides = {}) {
  const { createAuthSession } = await modulePromise;
  const user = { uid: 'alice' };
  const saved = [], cleared = [];
  const fixture = { user, saved, cleared };
  fixture.session = createAuthSession({
    currentUser: () => fixture.user,
    loadProfile: async user => ({ id: user.uid, uid: user.uid, displayName: user.uid }),
    cacheProfile: profile => saved.push(profile), clearCache: () => cleared.push(true),
    ...overrides
  });
  return fixture;
}
test('concurrent login and Auth observer share profile setup and publish once', async () => {
  const pending = deferred(); let requests = 0;
  const { session, user, saved } = await setup({ loadProfile: () => { requests++; return pending.promise; } });
  let notifications = 0;
  session.watch(() => notifications++);
  const first = session.restore(user), second = session.restore(user);
  assert.equal(first, second);
  assert.equal(session.state.ready, false);
  pending.resolve({ id: '42', uid: user.uid });
  await first;
  assert.equal(requests, 1);
  assert.equal(notifications, 1);
  assert.equal(saved.length, 1);
  assert.equal((await session.ready).profile.id, '42');
});
test('profile failure preserves Firebase identity and can recover on the same account', async () => {
  let fail = true;
  const fixture = await setup({ loadProfile: async () => { if (fail) throw Object.assign(new Error('Denied'), { code: 'permission-denied' }); return { id: '42', uid: 'alice' }; } });
  await fixture.session.restore(fixture.user);
  assert.equal(fixture.session.state.user.uid, 'alice');
  assert.equal(fixture.session.state.error.code, 'permission-denied');
  assert.equal(fixture.session.state.ready, true);
  assert.equal(fixture.cleared.length, 0);
  fail = false;
  await fixture.session.restore(fixture.user);
  assert.equal(fixture.session.state.error, null);
  assert.equal(fixture.session.state.profile.id, '42');
});
test('late profile response cannot restore an account after logout', async () => {
  const pending = deferred();
  const fixture = await setup({ loadProfile: () => pending.promise });
  const first = fixture.session.restore(fixture.user);
  fixture.user = null;
  await fixture.session.restore(null);
  pending.resolve({ id: 'alice', uid: 'alice' }); await first;
  assert.equal(fixture.session.state.user, null);
  assert.equal(fixture.session.state.profile, null);
  assert.equal(fixture.saved.length, 0);
  assert.equal(fixture.cleared.length, 1);
});
test('an old account failure cannot overwrite a newer signed-in account', async () => {
  const pending = deferred();
  const fixture = await setup({ loadProfile: user => user.uid === 'alice' ? pending.promise : Promise.resolve({ id: 'bob', uid: 'bob' }) });
  const first = fixture.session.restore(fixture.user);
  // Let Alice's loader start before switching identities.
  await Promise.resolve();
  fixture.user = { uid: 'bob' };
  await fixture.session.restore(fixture.user);
  pending.reject(new Error('Old request failed')); await first;
  assert.equal(fixture.session.state.user.uid, 'bob');
  assert.equal(fixture.session.state.profile.id, 'bob');
  assert.equal(fixture.session.state.error, null);
  assert.deepEqual(fixture.saved.map(p => p.id), ['bob']);
});
test('a request that never finishes settles with a retryable profile error', async () => {
  const fixture = await setup({ timeoutMs: 15, loadProfile: () => new Promise(() => {}) });
  await fixture.session.restore(fixture.user);
  assert.equal((await fixture.session.ready).error.code, 'profile/timeout');
  assert.equal(fixture.session.state.user.uid, 'alice');
  assert.equal(fixture.cleared.length, 0);
});
test('storage quota or privacy restrictions do not prevent sign-in or sign-out', async () => {
  const fixture = await setup({ cacheProfile: () => { throw new Error('QuotaExceededError'); }, clearCache: () => { throw new Error('SecurityError'); } });
  await fixture.session.restore(fixture.user);
  assert.equal(fixture.session.state.profile.id, 'alice');
  assert.equal(fixture.session.state.error, null);
  fixture.user = null; await fixture.session.restore(null);
  assert.equal(fixture.session.state.user, null);
  assert.equal(fixture.session.state.ready, true);
});
test('unsubscribed views receive no future account events', async () => {
  const fixture = await setup(); let notifications = 0;
  const stop = fixture.session.watch(() => notifications++);
  await fixture.session.restore(fixture.user); stop();
  fixture.user = null; await fixture.session.restore(null);
  assert.equal(notifications, 1);
});

test('a queued callback for a previous identity cannot clear the current account', async () => {
  const fixture = await setup();
  await fixture.session.restore(fixture.user);
  await fixture.session.restore(null);
  assert.equal(fixture.session.state.user.uid, 'alice');
  assert.equal(fixture.session.state.profile.id, 'alice');
  assert.equal(fixture.cleared.length, 0);
});
