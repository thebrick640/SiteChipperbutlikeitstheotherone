import { auth, state, restoreSession, saveProfile } from './social-api.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  updateProfile, getMultiFactorResolver, RecaptchaVerifier, PhoneAuthProvider, PhoneMultiFactorGenerator
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
const form = document.querySelector('#authForm');
const status = document.querySelector('#authStatus');
const submit = document.querySelector('#authSubmit');
let signup = false, busy = false;
const messages = {
  'auth/email-already-in-use': 'An account already uses that email. Sign in or reset your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Use a password with at least eight characters.',
  'auth/user-disabled': 'This account is unavailable. Contact support if you believe this is a mistake.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/invalid-verification-code': 'That verification code is incorrect. Please sign in again to retry.',
  'auth/code-expired': 'That verification code has expired. Please sign in again for a new code.',
  'auth/operation-not-allowed': 'Email sign-in is currently unavailable. Please contact support.',
  'auth/invalid-api-key': 'Sign-in is temporarily unavailable. Please contact support.',
  'auth/network-request-failed': 'Unable to connect. Check your connection and try again.'
};
const profileFailureMessage = 'You are signed in, but your profile could not load. Try signing in again to retry, or explore the community below.';
function report(message) { status.textContent = message; }
function setBusy(value) {
  busy = value;
  form.querySelectorAll('input,button').forEach(el => { el.disabled = value; });
  document.querySelector('#authToggle').disabled = value;
  document.querySelector('#passwordReset').disabled = value;
  form.setAttribute('aria-busy', String(value));
}
document.querySelector('#authToggle').onclick = () => {
  signup = !signup;
  document.querySelector('#nameField').hidden = !signup;
  form.elements.displayName.required = signup;
  form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
  form.elements.password.minLength = signup ? 8 : 1;
  document.querySelector('#authTitle').textContent = signup ? 'Join the pack' : 'Welcome back';
  submit.textContent = signup ? 'Create account' : 'Sign in';
  document.querySelector('#authToggle').textContent = signup ? 'Already a member? Sign in' : 'Create an account';
  report('');
  (signup ? form.elements.displayName : form.elements.email).focus();
};
async function finish(user, name) {
  await restoreSession(user);
  if (name) await saveProfile({ displayName: name, bio: state.profile.bio || '' });
  const next = new URLSearchParams(location.search).get('next');
  let target=new URL('/',location.origin);
  try { if(next)target=new URL(next,location.origin); } catch (_) {}
  location.assign(target.origin === location.origin ? target.pathname + target.search + target.hash : '/');
}
form.onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  const email = form.elements.email.value.trim(), password = form.elements.password.value;
  const name = form.elements.displayName.value.trim();
  if (signup && !name) { report('Enter a display name.'); form.elements.displayName.focus(); return; }
  setBusy(true); report(signup ? 'Creating your account…' : 'Signing in…');
  try {
    const result = signup ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password);
    if (signup) await updateProfile(result.user, { displayName: name });
    await finish(result.user, signup ? name : null);
  } catch (error) {
    if (error.code === 'auth/multi-factor-auth-required') {
      try {
        const resolver = getMultiFactorResolver(auth, error);
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        try {
          const provider = new PhoneAuthProvider(auth);
          const verificationId = await provider.verifyPhoneNumber({ multiFactorHint: resolver.hints[0], session: resolver.session }, verifier);
          const code = prompt('Enter the verification code sent to your phone:');
          if (!code) throw new Error('Verification cancelled. Sign in again when you are ready.');
          const result = await resolver.resolveSignIn(PhoneMultiFactorGenerator.assertion(PhoneAuthProvider.credential(verificationId, code.trim())));
          await finish(result.user);
        } finally { verifier.clear(); }
      } catch (mfaError) { report(messages[mfaError.code] || (mfaError.message.startsWith('Verification cancelled.') ? mfaError.message : auth.currentUser ? profileFailureMessage : 'Two-factor verification could not finish. Please try again.')); }
    } else report(messages[error.code] || (auth.currentUser ? profileFailureMessage : 'Could not finish signing in. Please try again.'));
    setBusy(false);
  }
};
document.querySelector('#passwordReset').onclick = async () => {
  const input = form.elements.email;
  if (!input.value.trim() || !input.reportValidity()) { report('Enter your email above to receive a reset link.'); input.focus(); return; }
  setBusy(true);
  try { await sendPasswordResetEmail(auth, input.value.trim()); report('If an account exists for that email, a password reset link is on its way.'); }
  catch (error) { report(messages[error.code] || 'Could not send a reset link. Please try again.'); }
  finally { setBusy(false); }
};

// Enabled only after all handlers and imports are ready.
document.querySelector('#authFields').disabled = false;
setBusy(false);
report('');
