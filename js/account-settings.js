import { auth, watchAuth, logout, restoreSession, friendlyError } from './social-api.js';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail,
  sendEmailVerification, reload, getMultiFactorResolver, RecaptchaVerifier, PhoneAuthProvider, PhoneMultiFactorGenerator
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
const host = document.querySelector('#accountSettings');
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let renderedAccount = '';
const errors = {
  'auth/invalid-credential':'Your current password is incorrect.', 'auth/wrong-password':'Your current password is incorrect.',
  'auth/weak-password':'Use at least eight characters for your new password.',
  'auth/requires-recent-login':'Sign in again, then retry this change.', 'auth/too-many-requests':'Too many attempts. Please try again later.',
  'auth/email-already-in-use':'That email is already in use.', 'auth/invalid-email':'Enter a valid email address.'
};
async function confirmIdentity(password) {
  try { await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password)); }
  catch (error) {
    if (error.code !== 'auth/multi-factor-auth-required') throw error;
    const resolver = getMultiFactorResolver(auth, error);
    const verifier = new RecaptchaVerifier(auth, 'accountRecaptcha', {size:'invisible'});
    try {
      const id = await new PhoneAuthProvider(auth).verifyPhoneNumber({multiFactorHint:resolver.hints[0],session:resolver.session},verifier);
      const code = prompt('Enter the verification code sent to your phone:');
      if (!code) throw Error('Verification cancelled.');
      await resolver.resolveSignIn(PhoneMultiFactorGenerator.assertion(PhoneAuthProvider.credential(id,code.trim())));
    } finally { verifier.clear(); }
  }
}
function bind(form, work) {
  form.onsubmit = async event => {
    event.preventDefault(); if(form.dataset.busy) return;
    const data = new FormData(form), status = form.querySelector('[role=status]');
    form.dataset.busy='1'; form.setAttribute('aria-busy','true');
    [...form.elements].forEach(e=>e.disabled=true); status.textContent='Working…';
    try { await work(data,status); form.reset(); }
    catch(error) { status.textContent=errors[error.code] || friendlyError(error); }
    finally { delete form.dataset.busy; form.removeAttribute('aria-busy'); [...form.elements].forEach(e=>e.disabled=false); }
  };
}
watchAuth(state => {
  const key = [state.user?.uid || '', state.profile?.id || '', !!state.error].join(':');
  if (key === renderedAccount) return;
  renderedAccount = key;
  if (state.user && !state.profile) {
    host.innerHTML = '<h2>Your account</h2><p>You are signed in, but your profile could not load.</p><div class="account-actions"><button id="retryAccount">Retry account</button><button id="accountLogout">Log out</button></div><p role="status"></p>';
    const status = host.querySelector('[role=status]');
    host.querySelector('#retryAccount').onclick = async event => {
      event.target.disabled = true;
      try { await restoreSession(); } catch (error) { status.textContent = friendlyError(error); }
      finally { event.target.disabled = false; }
    };
    host.querySelector('#accountLogout').onclick = () => logout().then(() => location.assign('/')).catch(error => { status.textContent = friendlyError(error); });
    return;
  }
  if(!state.profile) {host.innerHTML='<h2>Your account</h2><p><a href="/login.html?next=/settings">Sign in to manage your account.</a></p>';return;}
  const user=state.user, profileId=state.profile.id;
  host.innerHTML=`<h2>Your account</h2><p class="account-email">${escape(user.email)}</p><p id="emailVerification">${user.emailVerified?'Email verified':'Your email has not been verified.'}</p><div class="account-actions"><button id="verifyEmail" ${user.emailVerified?'hidden':''}>Send verification email</button><button id="refreshVerification">Check verification</button><button id="accountLogout">Log out</button></div><p id="accountStatus" role="status"></p>
  <details><summary>Change password</summary><form id="changePassword"><label>Current password<input name="current" type="password" autocomplete="current-password" required></label><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirm new password<input name="confirm" type="password" minlength="8" autocomplete="new-password" required></label><button type="submit">Change password</button><p role="status"></p></form></details>
  <details><summary>Change email address</summary><form id="changeEmail"><label>Current password<input name="current" type="password" autocomplete="current-password" required></label><label>New email address<input name="email" type="email" autocomplete="email" required></label><p>We will send a verification link to the new address. Your email changes after you open that link.</p><button type="submit">Send verification link</button><p role="status"></p></form></details>
  <details><summary>Delete account</summary><form id="deleteAccount"><p>This permanently deletes your profile, posts, replies, polls, votes, reactions, uploaded media and messages you sent. Other people's messages remain in their conversations. Communities remain available without your ownership. This cannot be undone.</p><label>Current password<input name="current" type="password" autocomplete="current-password" required></label><label>Type DELETE to confirm<input name="confirmation" pattern="DELETE" autocomplete="off" required></label><button type="submit" class="account-danger">Permanently delete my account</button><p role="status"></p></form></details><div id="accountRecaptcha"></div>`;
  const status=host.querySelector('#accountStatus');
  host.querySelector('#verifyEmail').onclick=async e=>{e.target.disabled=true;try{await sendEmailVerification(user);status.textContent='Verification email sent. Check your inbox.';}catch(error){status.textContent=errors[error.code]||friendlyError(error);}finally{e.target.disabled=false;}};
  host.querySelector('#refreshVerification').onclick=async()=>{try{await reload(user);host.querySelector('#emailVerification').textContent=user.emailVerified?'Email verified':'Not verified yet. Open the link in your email, then check again.';host.querySelector('#verifyEmail').hidden=user.emailVerified;}catch(error){status.textContent=friendlyError(error);}};
  host.querySelector('#accountLogout').onclick=()=>logout().then(()=>location.assign('/')).catch(e=>{status.textContent=friendlyError(e);});
  bind(host.querySelector('#changePassword'),async(data,status)=>{
    if(data.get('password')!==data.get('confirm'))throw Error('New passwords do not match.');
    await confirmIdentity(data.get('current')); await updatePassword(user,data.get('password'));status.textContent='Password changed.';
  });
  bind(host.querySelector('#changeEmail'),async(data,status)=>{
    await confirmIdentity(data.get('current'));await verifyBeforeUpdateEmail(user,data.get('email'));status.textContent='Verification link sent to your new email address.';
  });
  bind(host.querySelector('#deleteAccount'),async(data,status)=>{
    await confirmIdentity(data.get('current'));
    const response=await fetch('/api/account/delete',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken(true)},body:JSON.stringify({confirmation:data.get('confirmation')})});
    const result=await response.json().catch(()=>({error:'Account deletion is temporarily unavailable. Please try again later.'}));
    if(!response.ok||!result.accepted)throw Error(result.error||'Could not schedule deletion.');
    await logout();
    // Remove this device's account/draft caches, leaving appearance preferences intact.
    try { for(const key of Object.keys(localStorage)) if((key.startsWith('cb_draft_'+user.uid)||key.startsWith('cb_dm_draft_'+user.uid))||key==='cb_feed_'+user.uid||key==='user_'+profileId||key==='profile_'+profileId||key==='pfp_'+profileId)localStorage.removeItem(key); } catch (_) {}
    host.innerHTML='<h2>Account deletion requested</h2><p>You are signed out. Your account is locked while its data is removed. You do not need to keep this page open.</p><a href="/">Return home</a>';
  });
});
