// Coolbrador shared data layer (ES module).
// Firestore is the source of truth. Results are mirrored into the legacy
// localStorage keys (user_<id>, profile_<id>, pfp_<id>, ...) that the page
// scripts already render from, and writes go through the security rules.
import { auth, db, EMULATOR, getStorageInstance } from "/js/firebase.js";
import {
  onAuthStateChanged, signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  limit, onSnapshot, runTransaction, writeBatch, serverTimestamp, arrayUnion, arrayRemove,
  increment, Timestamp, documentId
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const DEFAULT_AVATAR = "/users/default/pfp.jpg";
const MIN_PUBLIC_ID = 100;

// ---------- utils ----------
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (err) { console.warn("[cb-cloud] could not cache", key, err && err.name); return false; }
  },
  raw(key, value) { try { localStorage.setItem(key, value); } catch {} },
  del(key) { try { localStorage.removeItem(key); } catch {} },
};

export function emit(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

export function toMillis(t) {
  if (!t) return Date.now();
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === "number") return t;
  const n = Date.parse(t);
  return Number.isNaN(n) ? Date.now() : n;
}

export function toIso(t) { return new Date(toMillis(t)).toISOString(); }

export function normalizeHandle(raw) {
  let h = String(raw || "").toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  if (h.length < 3) h = ((h ? h + "_" : "") + "lab").slice(0, 24);
  return h;
}

export function isValidHandle(h) { return /^[a-z0-9_]{3,24}$/.test(String(h || "")); }

function errorCode(err) { return (err && (err.code || err.message)) || "unknown"; }

// ---------- profiles ----------
const byUid = new Map();
const byPublicId = new Map();

function cacheProfile(p) {
  if (!p || !p.uid) return p;
  byUid.set(p.uid, p);
  if (p.publicId) byPublicId.set(String(p.publicId), p);
  return p;
}

export function legacyUser(p) {
  return {
    username: p.username,
    displayName: p.username,
    handle: p.handle,
    bio: p.bio || "",
    about: p.about || "",
    profilePicture: p.avatar || DEFAULT_AVATAR,
    banner: p.banner || "",
    aboutImage: p.aboutImage || "",
    socials: p.socials || [],
    layoutPreset: p.layoutPreset || "profile",
    joined: toMillis(p.createdAt),
    uid: p.uid,
    role: p.role || "user",
    cloud: true,
  };
}

export function legacyProfile(p) {
  return {
    id: String(p.publicId),
    displayName: p.username,
    handle: p.handle,
    bio: p.bio || "",
    about: p.about || "",
    avatar: p.avatar || DEFAULT_AVATAR,
    banner: p.banner || "",
    aboutImage: p.aboutImage || "",
    layoutPreset: p.layoutPreset || "profile",
    socials: p.socials || [],
    media: [],
    sections: p.sections || [],
    joined: toMillis(p.createdAt),
    uid: p.uid,
    role: p.role || "user",
    cloud: true,
  };
}

export function mirrorProfile(p) {
  if (!p || !p.publicId) return;
  const id = String(p.publicId);
  store.set("user_" + id, legacyUser(p));
  store.set("profile_" + id, legacyProfile(p));
  store.raw("pfp_" + id, p.avatar || DEFAULT_AVATAR);
}

async function fetchUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? cacheProfile({ uid, ...snap.data() }) : null;
}

export async function getProfileByUid(uid, { fresh = false } = {}) {
  if (!uid) return null;
  if (!fresh && byUid.has(uid)) return byUid.get(uid);
  const p = await fetchUser(uid);
  if (p) mirrorProfile(p);
  return p;
}

export async function getProfileByPublicId(id, { fresh = false } = {}) {
  id = String(id || "");
  if (!/^\d+$/.test(id)) return null;
  if (!fresh && byPublicId.has(id)) return byPublicId.get(id);
  const snap = await getDoc(doc(db, "publicIds", id));
  if (!snap.exists()) return null;
  return getProfileByUid(snap.data().uid, { fresh: true });
}

export async function getProfileByHandle(handle) {
  const h = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!isValidHandle(h)) return null;
  const snap = await getDoc(doc(db, "handles", h));
  if (!snap.exists()) return null;
  return getProfileByUid(snap.data().uid);
}

// Batch-load profiles for many public ids (feeds, friend lists). Mirrors each one.
export async function getProfilesByPublicIds(ids) {
  const want = [...new Set((ids || []).map(String).filter((id) => /^\d+$/.test(id) && Number(id) >= MIN_PUBLIC_ID))];
  const missing = want.filter((id) => !byPublicId.has(id));
  for (let i = 0; i < missing.length; i += 30) {
    const chunk = missing.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, "users"), where("publicId", "in", chunk)));
    snap.forEach((d) => mirrorProfile(cacheProfile({ uid: d.id, ...d.data() })));
  }
  return want.map((id) => byPublicId.get(id)).filter(Boolean);
}

export async function searchUsers(text, max = 8) {
  const q = String(text || "").trim().replace(/^@/, "").toLowerCase();
  if (!q) return [];
  const out = new Map();
  const handleQ = normalizeHandle(q);
  const snap = await getDocs(query(collection(db, "users"), where("handle", ">=", handleQ),
    where("handle", "<", handleQ + "\uf8ff"), orderBy("handle"), limit(max)));
  snap.forEach((d) => out.set(d.id, cacheProfile({ uid: d.id, ...d.data() })));
  if (/^\d+$/.test(q)) {
    const p = await getProfileByPublicId(q).catch(() => null);
    if (p) out.set(p.uid, p);
  }
  const list = [...out.values()];
  list.forEach(mirrorProfile);
  return list;
}

// ---------- account (signup / sign-in) ----------
export async function isHandleAvailable(handle) {
  if (!isValidHandle(handle)) return false;
  const snap = await getDoc(doc(db, "handles", handle));
  return !snap.exists();
}

// Allocates the next public id, claims the handle and creates the public
// profile in one transaction (validated by firestore.rules).
async function createAccount(user, { username, handle } = {}) {
  const fallbackName = user.displayName || String(user.email || "").split("@")[0] || "Labrador";
  const name = String(username || fallbackName).trim().slice(0, 40) || "Labrador";
  const base = normalizeHandle(handle || name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : base.slice(0, 19) + "_" + Math.floor(1000 + Math.random() * 9000);
    try {
      return await runTransaction(db, async (tx) => {
        const counterRef = doc(db, "counters", "users");
        const handleRef = doc(db, "handles", candidate);
        const userRef = doc(db, "users", user.uid);
        const counter = await tx.get(counterRef);
        const taken = await tx.get(handleRef);
        const existing = await tx.get(userRef);
        if (existing.exists()) return { uid: user.uid, ...existing.data() };
        if (taken.exists()) throw Object.assign(new Error("handle-taken"), { code: "handle-taken" });
        const id = Math.max(counter.exists() ? Number(counter.data().nextId) || 0 : 0, MIN_PUBLIC_ID);
        const data = {
          publicId: String(id), handle: candidate, username: name, avatar: "", bio: "", about: "",
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), role: "user", banned: false,
        };
        tx.set(counterRef, { nextId: id + 1 });
        tx.set(doc(db, "publicIds", String(id)), { uid: user.uid, createdAt: serverTimestamp() });
        tx.set(handleRef, { uid: user.uid, createdAt: serverTimestamp() });
        tx.set(userRef, data);
        return { uid: user.uid, ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
      });
    } catch (err) {
      if (errorCode(err) === "handle-taken") continue;
      throw err;
    }
  }
  throw new Error("Could not reserve a username handle. Try another name.");
}

export async function ensureAccount(user, opts) {
  if (!user) return null;
  let p = await fetchUser(user.uid);
  if (p) return p;
  try {
    return cacheProfile(await createAccount(user, opts));
  } catch (err) {
    // Another tab or listener may have created the account first.
    p = await fetchUser(user.uid).catch(() => null);
    if (p) return p;
    throw err;
  }
}

// Signup details registered before the auth user exists, so the auth
// listener (which fires first) creates the profile with the chosen handle.
let pendingSignup = null;
export function setPendingSignup(opts) { pendingSignup = opts || null; }

let me = null;
export function currentProfile() { return me; }
export function currentUid() { return (auth.currentUser && auth.currentUser.uid) || null; }

function mirrorSelf(p) {
  mirrorProfile(p);
  store.raw("loggedIn", "true");
  store.raw("currentUserId", String(p.publicId));
  store.raw("firebaseUid", p.uid);
}

// Per-account data that must not leak to the next person on this device.
const PRIVATE_KEY_PATTERNS = [/^cb_messages/, /^cb_notifications/, /^reposts_/, /^friends_/, /^cb_blocked_users$/,
  /^cb_chipper_link_v1$/, /^cb_cloud_/];

export function clearPrivateMirror() {
  ["loggedIn", "currentUserId", "firebaseUid"].forEach(store.del);
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach((k) => { if (k && PRIVATE_KEY_PATTERNS.some((re) => re.test(k))) store.del(k); });
  } catch {}
  try { sessionStorage.removeItem("cb_auth_chrome_v2"); } catch {}
}

// Resolves the signed-in Firebase user to a Coolbrador profile, creating the
// account record on first sign-in, and mirrors it for the page scripts.
const syncing = new Map();
export function syncSession(user, opts) {
  if (!user) {
    const had = !!me;
    me = null;
    if (had) clearPrivateMirror();
    return Promise.resolve(null);
  }
  if (me && me.uid === user.uid && !opts) return Promise.resolve(me);
  if (syncing.has(user.uid)) return syncing.get(user.uid);
  const run = (async () => {
    const p = await ensureAccount(user, opts || pendingSignup);
    pendingSignup = null;
    if (me && me.uid !== p.uid) clearPrivateMirror();
    me = p;
    mirrorSelf(p);
    emit("cb-cloud-session", { signedIn: true, userId: String(p.publicId), uid: p.uid });
    return p;
  })().finally(() => syncing.delete(user.uid));
  syncing.set(user.uid, run);
  return run;
}

export async function signOut() {
  try { await fbSignOut(auth); } catch {}
  me = null;
  clearPrivateMirror();
}

// ---------- media uploads ----------
function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(",");
  const mime = (/data:([^;]+)/.exec(head) || [])[1] || "application/octet-stream";
  const bin = /;base64/.test(head) ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/mpeg": "mp3", "audio/wav": "wav",
  "audio/ogg": "ogg", "audio/webm": "weba" };

// Uploads a File/Blob or data: URL to media/<uid>/ and returns { url, path, type }.
export async function uploadMedia(input, { prefix = "m" } = {}) {
  const uid = currentUid();
  if (!uid) throw new Error("Sign in to upload media");
  const blob = typeof input === "string" ? dataUrlToBlob(input) : input;
  const mime = blob.type || "application/octet-stream";
  const kind = mime.split("/")[0];
  if (!["image", "video", "audio"].includes(kind)) throw new Error("Unsupported file type");
  const name = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${EXT[mime] || "bin"}`;
  const path = `media/${uid}/${name}`;
  const storageMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js");
  const storage = await getStorageInstance();
  const ref = storageMod.ref(storage, path);
  await storageMod.uploadBytes(ref, blob, { contentType: mime, cacheControl: "public,max-age=31536000" });
  const url = await storageMod.getDownloadURL(ref);
  return { url, path, type: kind };
}

async function ensureRemoteUrl(value, prefix) {
  if (typeof value === "string" && value.startsWith("data:")) return (await uploadMedia(value, { prefix })).url;
  return value;
}

function cleanUrl(v) {
  const s = String(v || "");
  return /^(https?:\/\/|\/)[^\s"<>]*$/.test(s) && s.length <= 2048 ? s : "";
}

// Saves the signed-in user's profile edits (legacy profile shape from profile.js).
export async function saveMyProfile(legacy) {
  const uid = currentUid();
  if (!uid || !me) throw new Error("Sign in to edit your profile");
  const avatar = await ensureRemoteUrl(legacy.avatar, "avatar");
  const banner = await ensureRemoteUrl(legacy.banner, "banner");
  const aboutImage = await ensureRemoteUrl(legacy.aboutImage, "about");
  const socials = (Array.isArray(legacy.socials) ? legacy.socials : [])
    .map((s) => ({ type: String(s.type || "link").slice(0, 24), label: String(s.label || "").slice(0, 40),
      url: cleanUrl(s.url), id: String(s.id || "").slice(0, 40) }))
    .filter((s) => s.url).slice(0, 16);
  const sections = (Array.isArray(legacy.sections) ? legacy.sections : [])
    .map((s) => ({ id: String(s.id || "").slice(0, 40), label: String(s.label || "").slice(0, 60), style: String(s.style || "surface").slice(0, 24) }))
    .slice(0, 20);
  const patch = {
    username: String(legacy.displayName || me.username).trim().slice(0, 40) || me.username,
    bio: String(legacy.bio || "").slice(0, 280),
    about: String(legacy.about || "").slice(0, 1200),
    avatar: cleanUrl(avatar === DEFAULT_AVATAR ? "" : avatar),
    banner: cleanUrl(banner === "/img/PlanetChipperHomepage.png" ? "" : banner),
    aboutImage: cleanUrl(aboutImage === "/img/favicon3.ico" ? "" : aboutImage),
    socials,
    sections,
    layoutPreset: ["profile", "card", "links"].includes(legacy.layoutPreset) ? legacy.layoutPreset : "profile",
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "users", uid), patch);
  me = cacheProfile({ ...me, ...patch, updatedAt: Timestamp.now() });
  mirrorSelf(me);
  emit("cb-cloud-profile", { userId: String(me.publicId) });
  return me;
}

// ---------- bootstrap ----------
let readyResolve;
export const ready = new Promise((r) => { readyResolve = r; });
let firstAuth = true;

onAuthStateChanged(auth, async (user) => {
  try { await syncSession(user); }
  catch (err) { console.warn("[cb-cloud] session sync failed", errorCode(err)); }
  if (firstAuth) { firstAuth = false; readyResolve(api); }
});

const api = {
  db, auth, EMULATOR, store, emit, toMillis, toIso, ready,
  normalizeHandle, isValidHandle, isHandleAvailable, ensureAccount, syncSession, setPendingSignup, signOut, clearPrivateMirror,
  currentProfile, currentUid, getProfileByUid, getProfileByPublicId, getProfileByHandle, getProfilesByPublicIds,
  searchUsers, mirrorProfile, legacyUser, legacyProfile, saveMyProfile, uploadMedia,
  // Firestore primitives for feature modules loaded as classic scripts.
  fs: { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit,
    onSnapshot, runTransaction, writeBatch, serverTimestamp, arrayUnion, arrayRemove, increment, Timestamp, documentId },
};

window.CBCloud = api;
emit("cb-cloud-loaded", {});
export default api;
