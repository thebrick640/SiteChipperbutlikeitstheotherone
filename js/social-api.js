// Shared social data. Firebase Auth is the authority; browser storage is only a UI cache.
import { createAuthSession } from './auth-session.mjs';
import { searchWords, searchTokens } from './search-utils.mjs';
import { auth, db, getStorageInstance } from './firebase.js';
import { onAuthStateChanged, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, startAfter, documentId, onSnapshot, serverTimestamp, writeBatch, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export { auth };
export const BOARDS = ['General', 'BeeSid', 'Starry', 'ChipperCorner', 'Labradoria', 'MutinyDesk', 'GiftDrive', 'FarmReport', 'FarmDESTROYERSCLUB', 'Invasions', 'Mutinies4Lyfe', 'testboard'];
export const boardInfo = new Map();
const profiles = new Map();
export const timestamp = value => value?.toMillis?.() || (typeof value === 'number' ? value : Date.parse(value)) || 0;
export const pairId = (a, b) => [a, b].sort().join('__');
const row = snapshot => ({ ...snapshot.data(), id: snapshot.id });
function signedIn() {
  if (!auth.currentUser || !state.profile || state.user?.uid !== auth.currentUser.uid) throw new Error('Sign in to continue.');
  return auth.currentUser.uid;
}
function text(value, max, label) {
  value = String(value || '').trim();
  if (!value || value.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return value;
}
export function friendlyError(error) {
  if (error?.code === 'permission-denied' || error?.code === 'storage/unauthorized') return 'This action was not allowed. If you just posted or sent a request, wait a few seconds and try again; otherwise check your account permissions.';
  if (error?.code === 'unavailable' || error?.code === 'auth/network-request-failed') return 'Connection lost. Your draft is still here; please try again.';
  return error?.message || 'Something went wrong. Please try again.';
}
export async function ensureProfile(user, displayName) {
  // Preserve established profile URLs. New accounts use collision-free Auth IDs.
  const existing = await getDocs(query(collection(db, 'profiles'), where('uid', '==', user.uid), limit(1)));
  if (!existing.empty) {
    const profile = row(existing.docs[0]);
    profiles.set(profile.id, profile);
    return profile;
  }
  const profile = { uid: user.uid, displayName: text(String(displayName || user.displayName || 'New Labrador').trim().slice(0, 48) || 'New Labrador', 48, 'Display name'),
    bio: '', avatarUrl: '/users/default/pfp.jpg', createdAt: serverTimestamp(), searchTokens:searchTokens(displayName || user.displayName || 'New Labrador') };
  await runTransaction(db, async tx => {
    const ref = doc(db, 'profiles', user.uid);
    if (!(await tx.get(ref)).exists()) tx.set(ref, profile);
  });
  return row(await getDoc(doc(db, 'profiles', user.uid)));
}
function cacheProfile(profile) {
  const id = profile.id;
  profiles.set(id, profile);
  try {
    localStorage.setItem('user_' + id, JSON.stringify({ ...profile, username: profile.displayName, profilePicture: profile.avatarUrl }));
    localStorage.setItem('profile_' + id, JSON.stringify({ ...profile, avatar: profile.avatarUrl }));
    localStorage.setItem('pfp_' + id, profile.avatarUrl || '/users/default/pfp.jpg');
  } catch (_) { /* Storage full/private mode must not block a real session. */ }
}
const session = createAuthSession({
  currentUser: () => auth.currentUser,
  loadProfile: ensureProfile,
  cacheProfile(profile, user) {
    cacheProfile(profile);
    // Keep both IDs together so a cached profile from another account is never
    // used when restoring navigation. These hints grant no data access.
    try {
      localStorage.setItem('currentUserId', profile.id);
      localStorage.setItem('firebaseUid', user.uid);
      localStorage.setItem('loggedIn', 'true');
    } catch (_) {}
  },
  clearCache() {
    try {
      for (const key of ['loggedIn', 'currentUserId', 'firebaseUid']) localStorage.removeItem(key);
      sessionStorage.removeItem('cb_auth_chrome_v2');
    } catch (_) {}
  },
  changed: state => window.dispatchEvent(new CustomEvent('cb-social-auth', { detail: state }))
});
export const { state, ready } = session;
export const watchAuth = session.watch;
export async function restoreSession(user = auth.currentUser) {
  await session.restore(user);
  if (auth.currentUser?.uid !== user?.uid) throw new Error('Your account changed. Please sign in again.');
  if (state.error) throw state.error;
  return state.profile;
}
onAuthStateChanged(auth, user => {
  try {
    if (user && localStorage.getItem('firebaseUid') !== user.uid) {
      for (const key of ['loggedIn', 'currentUserId', 'firebaseUid']) localStorage.removeItem(key);
      sessionStorage.removeItem('cb_auth_chrome_v2');
    }
  } catch (_) {}
  session.restore(user);
});
export async function logout() { await signOut(auth); }
export async function profile(id) {
  if (profiles.has(id)) return profiles.get(id);
  const snap = await getDoc(doc(db, 'profiles', id));
  if (!snap.exists()) return null;
  const value = row(snap); cacheProfile(value); return value;
}
export async function peoplePage(after, count = 30) {
  const clauses = [orderBy(documentId())]; if (after) clauses.push(startAfter(after));
  const snap = await getDocs(query(collection(db, 'profiles'), ...clauses, limit(count)));
  return { rows: snap.docs.map(s => { const p = row(s); cacheProfile(p); return p; }), cursor: snap.docs.at(-1), hasMore: snap.size === count };
}
export async function profileByUid(uid) {
  const cached = [...profiles.values()].find(p => p.uid === uid); if (cached) return cached;
  const snap = await getDocs(query(collection(db, 'profiles'), where('uid','==',uid), limit(1)));
  if (snap.empty) return null;
  const p = row(snap.docs[0]); cacheProfile(p); return p;
}
// A growing live window keeps inserts/deletes consistent while exposing older rows.
export function liveWindow(makeQuery, success, error, size = 30) {
  let count = size, stop, disposed = false;
  function subscribe() { stop?.(); stop = onSnapshot(makeQuery(count), snap => success(snap.docs.map(row), snap.size === count), error); }
  const dispose = () => { disposed = true; stop?.(); };
  dispose.more = () => { if (!disposed) { count += size; subscribe(); } };
  subscribe(); return dispose;
}
export async function saveProfile(fields) {
  signedIn();
  const value = { displayName: text(fields.displayName, 48, 'Display name'), bio: String(fields.bio || '').trim().slice(0, 500) };
  value.searchTokens=searchTokens(value.displayName+' '+value.bio);
  if (fields.avatarUrl) {value.avatarUrl = fields.avatarUrl;if(fields.avatarPath)value.avatarPath=fields.avatarPath;}
  await updateDoc(doc(db, 'profiles', state.profile.id), value);
  state.profile = { ...state.profile, ...value };
  cacheProfile(state.profile);
  await updateProfile(auth.currentUser, { displayName: value.displayName, photoURL: value.avatarUrl || state.profile.avatarUrl });
  session.notify();
}
export async function upload(file) {
  const uid = signedIn();
  if (!file) return null;
  if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/.test(file.type)) throw new Error('Choose a JPG, PNG, GIF, WebP, MP4 or WebM file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Media must be 10 MB or smaller.');
  const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
  const path = `media/${uid}/${crypto.randomUUID()}`;
  const target = ref(await getStorageInstance(), path);
  await uploadBytes(target, file, { contentType: file.type });
  return { url: await getDownloadURL(target), type: file.type.startsWith('video/') ? 'video' : 'image', path };
}
function activity(batch, kind, operationId) {
  batch.set(doc(db,'users',signedIn(),'activity',kind),{at:serverTimestamp(),operationId});
}
async function limitedCreate(kind, collectionName, value) {
  const target=doc(collection(db,collectionName)), batch=writeBatch(db);
  activity(batch,kind,target.id); batch.set(target,value); await batch.commit();return target;
}
export async function createPost({ body, board = 'General', media = null, contentWarnings = [] }) {
  const uid = signedIn();
  body = String(body || '').trim();
  if ((!body && !media) || body.length > 2000) throw new Error('Write a post or attach media (up to 2,000 characters).');
  if (!BOARDS.includes(board)) throw new Error('Choose a community from the list.');
  if (window.CoolbradorMediaSafety?.scanText(body)?.blocked) throw new Error('This content cannot be posted.');
  const classified = window.CoolbradorSensitiveFilter?.classifyPost({ text: body, contentWarnings });
  contentWarnings = classified?.contentWarnings || contentWarnings;
  const ref = await limitedCreate('post','posts', { authorId: uid, profileId: state.profile.id, board, text: body,
    media, contentWarnings, searchTokens:searchTokens(body), inGame: board === 'BeeSid', createdAt: serverTimestamp(), editedAt: null });
  return ref.id;
}
export function watchPosts({ board, authorId, authorIds, after, count = 30 } = {}, success, error) {
  const clauses = [];
  if (board) clauses.push(where('board', '==', board));
  if (authorId) clauses.push(where('authorId', '==', authorId));
  if (authorIds) clauses.push(where('authorId', 'in', authorIds));
  clauses.push(orderBy('createdAt', 'desc'));
  if (after) clauses.push(startAfter(after));
  clauses.push(limit(count));
  return onSnapshot(query(collection(db, 'posts'), ...clauses), snap => success(snap.docs.map(row), snap.docs.at(-1)), error);
}
export function watchPost(id, success, error) {
  return onSnapshot(doc(db, 'posts', id), snap => success(snap.exists() ? row(snap) : null), error);
}
export async function editPost(id, body) { signedIn(); await updateDoc(doc(db, 'posts', id), { text: text(body, 2000, 'Post'), searchTokens:searchTokens(body), editedAt: serverTimestamp() }); }
export async function removePost(id) { signedIn(); await deleteDoc(doc(db, 'posts', id)); }
export function watchReactions(id, success, error) {
  return onSnapshot(collection(db, 'posts', id, 'reactions'), snap => success(snap.docs.map(row)), error);
}
export async function react(id, kind) {
  const uid = signedIn();
  if (!['yeah', 'repost'].includes(kind)) throw new Error('Unknown reaction.');
  const ref = doc(db, 'posts', id, 'reactions', uid);
  await runTransaction(db, async tx => {
    const current = await tx.get(ref);
    const value = current.exists() ? current.data() : { yeah: false, repost: false };
    tx.set(ref, { ...value, [kind]: !value[kind] });
    if (kind === 'repost') {
      const repost = doc(db, 'reposts', uid + '__' + id);
      if (value.repost) tx.delete(repost);
      else tx.set(repost, { authorId: uid, profileId: state.profile.id, postId: id, createdAt: serverTimestamp() });
    }
  });
}
export function watchComments(id, success, error) {
  return liveWindow(count => query(collection(db, 'posts', id, 'comments'), orderBy('createdAt'), limit(count)), success, error);
}
export async function comment(post, body, media = null) {
  const uid = signedIn();
  const ref = doc(collection(db, 'posts', post.id, 'comments'));
  const batch = writeBatch(db);
  const value = text(body, 2000, 'Reply');
  activity(batch,'reply',ref.id);
  batch.set(ref, { authorId: uid, profileId: state.profile.id, text: value, media, createdAt: serverTimestamp() });
  if (post.authorId !== uid) batch.set(doc(db, 'users', post.authorId, 'notifications', ref.id), {
    senderId: uid, profileId: state.profile.id, kind: 'reply', postId: post.id, commentId: ref.id,
    text: value.slice(0, 160), read: false, createdAt: serverTimestamp()
  });
  await batch.commit();
}
export async function removeComment(postId, id) { signedIn(); await deleteDoc(doc(db, 'posts', postId, 'comments', id)); }
export function watchFriends(success, error) {
  return onSnapshot(query(collection(db, 'friendships'), where('participants', 'array-contains', signedIn())), snap => success(snap.docs.map(row)), error);
}
export async function requestFriend(target) {
  const uid = signedIn();
  if (target === uid) throw new Error('That is your account.');
  const id=pairId(uid,target),batch=writeBatch(db);activity(batch,'friend',id);
  batch.set(doc(db,'friendships',id), { participants: [uid,target].sort(), requester:uid,status:'pending',createdAt:serverTimestamp() });await batch.commit();
}
export async function acceptFriend(id) { signedIn(); await updateDoc(doc(db, 'friendships', id), { status: 'accepted' }); }
export async function removeFriend(id) { signedIn(); await deleteDoc(doc(db, 'friendships', id)); }
export function watchBlocks(success, error) {
  return onSnapshot(collection(db, 'users', signedIn(), 'blocks'), snap => success(snap.docs.map(s => s.id)), error);
}
export async function block(target, blocked) {
  const ref = doc(db, 'users', signedIn(), 'blocks', target);
  if (blocked) await setDoc(ref, { createdAt: serverTimestamp() }); else await deleteDoc(ref);
}
export async function report(post, reason) { return reportContent({postId:post.id},reason); }
export async function reportContent(target, reason) {
  await limitedCreate('report','reports', { ...target, reporter: signedIn(), reason: text(reason, 1000, 'Report'), createdAt: serverTimestamp() });
}
export async function openConversation(target) {
  const uid = signedIn();
  if (uid === target) throw new Error('Choose another person.');
  const id = pairId(uid, target), ref = doc(db, 'conversations', id);
  await runTransaction(db, async tx => {
    if (!(await tx.get(ref)).exists()) tx.set(ref, { participants: [uid, target].sort(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return id;
}
export function watchConversations(success, error) {
  return onSnapshot(query(collection(db, 'conversations'), where('participants', 'array-contains', signedIn())), snap => success(snap.docs.map(row).sort((a,b) => timestamp(b.updatedAt)-timestamp(a.updatedAt))), error);
}
export function watchMessages(id, success, error) {
  return liveWindow(count => query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'desc'), limit(count)), (rows, more) => success(rows.reverse(), more), error);
}
export async function sendMessage(id, body) {
  const uid = signedIn(), batch = writeBatch(db);
  const message=doc(collection(db, 'conversations', id, 'messages'));
  activity(batch,'message',message.id);
  batch.set(message, { senderId: uid, text: text(body, 2000, 'Message'), createdAt: serverTimestamp() });
  batch.update(doc(db, 'conversations', id), { updatedAt: serverTimestamp(), lastSenderId:uid, lastMessageId:message.id });
  await batch.commit();
}
export function watchNotifications(success, error) {
  const uid = signedIn(); return liveWindow(count => query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(count)), success, error);
}
export async function markRead(id) { await updateDoc(doc(db, 'users', signedIn(), 'notifications', id), { read: true }); }
export async function createPoll(title, options, board) {
  const uid = signedIn();
  options = options.map(v => text(v, 80, 'Choice'));
  if (options.length < 2 || options.length > 6 || new Set(options.map(v => v.toLowerCase())).size !== options.length) throw new Error('Use 2–6 different choices.');
  if (!BOARDS.includes(board)) throw new Error('Choose a community.');
  return limitedCreate('poll','polls', { authorId: uid, profileId: state.profile.id, title: text(title, 180, 'Question'), options, board, createdAt: serverTimestamp() });
}
export function watchPolls(success, error) { return liveWindow(count => query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(count)), success, error); }
export function watchVotes(id, success, error) { return onSnapshot(query(collection(db, 'polls', id, 'votes'), orderBy('createdAt')), snap => success(snap.docs.map(row)), error); }
export async function vote(id, choice) { await setDoc(doc(db, 'polls', id, 'votes', signedIn()), { choice, createdAt: serverTimestamp() }); }

export function watchReposts({ authorId, authorIds, count = 30 } = {}, success, error) {
  const filters = authorId ? [where('authorId', '==', authorId)] : authorIds ? [where('authorId', 'in', authorIds)] : [];
  return onSnapshot(query(collection(db, 'reposts'), ...filters, orderBy('createdAt', 'desc'), limit(count)), snap => success(snap.docs.map(row)), error);
}
export async function getPost(id) { const snap = await getDoc(doc(db, 'posts', id)); return snap.exists() ? row(snap) : null; }
export async function isModerator() { return !!auth.currentUser && (await auth.currentUser.getIdTokenResult()).claims.moderator === true; }
export function watchReports(success, error) { return liveWindow(count => query(collection(db, 'reports'), orderBy('createdAt','desc'), limit(count)), success, error); }


export async function loadBoards() {
  let cursor;
  for (;;) {
    const snapshot = await getDocs(query(collection(db, 'boards'), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(100)));
    snapshot.docs.forEach(s => { const b = row(s); boardInfo.set(b.id, b); if (!BOARDS.includes(b.id)) BOARDS.push(b.id); });
    if (snapshot.size < 100) break; cursor = snapshot.docs.at(-1);
  }
}
export async function createBoard(name, description) {
  const uid = signedIn();
  name = text(name, 48, 'Community name');
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32);
  if (id.length < 3 || BOARDS.some(b => b.toLowerCase() === id)) throw new Error('Choose a different name with at least three letters or numbers.');
  const value = { name, description: String(description || '').trim().slice(0,280), ownerId: uid, createdAt: serverTimestamp() };
  await runTransaction(db, async tx => {
    const target = doc(db, 'boards', id);
    if ((await tx.get(target)).exists()) throw new Error('That community name is already taken.');
    activity(tx,'board',id);
    tx.set(target, value);
  });
  return id;
}
export async function updateBoard(id, description) { signedIn(); await updateDoc(doc(db,'boards',id),{description:String(description).trim().slice(0,280)}); }

export function watchUnreadNotifications(success, error) {
  return onSnapshot(query(collection(db,'users',signedIn(),'notifications'),where('read','==',false),limit(100)),snap=>success(snap.size),error);
}
export async function markAllNotificationsRead() {
  const uid=signedIn();
  for (;;) {
    const snap=await getDocs(query(collection(db,'users',uid,'notifications'),where('read','==',false),limit(100)));
    if(snap.empty)return;
    const batch=writeBatch(db);snap.docs.forEach(s=>batch.update(s.ref,{read:true}));await batch.commit();
  }
}
export function watchConversationReads(success,error) {
  return onSnapshot(collection(db,'users',signedIn(),'conversationReads'),snap=>success(new Map(snap.docs.map(s=>[s.id,timestamp(s.data().readAt)]))),error);
}
export async function markConversationRead(id) {
  await setDoc(doc(db,'users',signedIn(),'conversationReads',id),{readAt:serverTimestamp()});
}
export async function closePoll(id) { signedIn(); await updateDoc(doc(db,'polls',id),{closedAt:serverTimestamp()}); }
export async function removePoll(id) { signedIn(); await deleteDoc(doc(db,'polls',id)); }

function pinnedWindow(base, target, success, error) {
  let rows=[],more=false,pinned=null;
  const emit=()=>success(pinned&&!rows.some(r=>r.id===pinned.id)?[pinned,...rows]:rows,more);
  const stop=base((data,hasMore)=>{rows=data;more=hasMore;emit();},error);
  const stopPin=target?onSnapshot(target,snap=>{pinned=snap.exists()?row(snap):null;emit();},error):()=>{};
  const dispose=()=>{stop();stopPin();};dispose.more=()=>stop.more();return dispose;
}
export function watchLinkedComments(id, focus, success, error) {
  return pinnedWindow((next,fail)=>watchComments(id,next,fail),focus?doc(db,'posts',id,'comments',focus):null,success,error);
}
export function watchLinkedPolls(focus, success, error) {
  return pinnedWindow(watchPolls,focus?doc(db,'polls',focus):null,success,error);
}

export async function searchPublic(kind, term, after) {
 const words=searchWords(term);if(!words.length)return{rows:[],hasMore:false};
 if(!['posts','profiles'].includes(kind))throw Error('Unknown search type.');
 const snap=await getDocs(query(collection(db,kind),where('searchTokens','array-contains',words[0]),orderBy(documentId()),...(after?[startAfter(after)]:[]),limit(30)));
 return {rows:snap.docs.map(row).filter(r=>words.every(w=>r.searchTokens.includes(w))),hasMore:snap.size===30,cursor:snap.docs.at(-1)};
}

export async function discardUpload(media) {
 const uid=signedIn();if(!media?.path?.startsWith('media/'+uid+'/'))return;
 const {ref,deleteObject}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
 await deleteObject(ref(await getStorageInstance(),media.path));
}

export function watchOwnReports(success,error) {
  return onSnapshot(query(collection(db,'reports'),where('reporter','==',signedIn())),snap=>success(snap.docs.map(row)),error);
}
export function watchDecisions(success,error) {
  return onSnapshot(query(collection(db,'moderationDecisions'),where('recipients','array-contains',signedIn())),snap=>success(snap.docs.map(row)),error);
}
