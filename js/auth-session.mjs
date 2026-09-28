// Auth is authoritative. Profile loading and browser caches must not turn a
// valid Firebase session into a sign-out, or keep public pages waiting forever.
export function createAuthSession({ currentUser, loadProfile, cacheProfile, clearCache, changed = () => {}, timeoutMs = 10000 }) {
  const state = { user: null, profile: null, ready: false, error: null };
  const listeners = new Set();
  let generation = 0, pending = null, resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  function publish() {
    state.ready = true;
    resolveReady(state);
    // A broken view must not stop the other subscribers (including sign-in).
    for (const fn of listeners) {
      try { fn(state); } catch (error) { console.error('Account view failed', error); }
    }
    changed(state);
  }
  function restore(user) {
    if (user?.uid !== currentUser()?.uid) return Promise.resolve(state);
    if (pending && pending.uid === user?.uid) return pending.promise;
    const revision = ++generation;
    state.user = user;
    state.profile = null;
    state.error = null;
    state.ready = false;
    if (!user) {
      pending = null;
      try { clearCache(); } catch (_) { /* Cache availability is optional. */ }
      publish();
      return Promise.resolve(state);
    }
    const promise = (async () => {
      let timer;
      try {
        const profile = await Promise.race([
          Promise.resolve().then(() => loadProfile(user)),
          new Promise((_, reject) => { timer = setTimeout(() => {
            const error = new Error('Your account is signed in, but your profile is taking too long to load. Please retry.');
            error.code = 'profile/timeout';
            reject(error);
          }, timeoutMs); })
        ]);
        if (revision !== generation || currentUser()?.uid !== user.uid) return state;
        state.profile = profile;
        try { cacheProfile(profile, user); } catch (_) { /* Storage is only a UI cache. */ }
      } catch (error) {
        if (revision !== generation || currentUser()?.uid !== user.uid) return state;
        state.error = error;
      } finally {
        clearTimeout(timer);
        if (revision === generation) pending = null;
      }
      if (revision === generation && currentUser()?.uid === user.uid) {
        pending = null;
        publish();
      }
      return state;
    })();
    pending = { uid: user.uid, promise };
    return promise;
  }
  function watch(fn) {
    listeners.add(fn);
    if (state.ready) fn(state);
    return () => listeners.delete(fn);
  }
  return { state, ready, restore, watch, notify: publish };
}
