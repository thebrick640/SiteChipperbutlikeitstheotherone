// Security-rules tests. Run with `npm test` (starts the Firestore emulator).
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, runTransaction, writeBatch,
  serverTimestamp, arrayUnion, arrayRemove, increment, Timestamp
} from "firebase/firestore";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const dbFor = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// Same transaction js/cb-cloud.js runs at signup.
async function createAccount(db, uid, handle, username = handle) {
  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, "counters/users");
    const handleRef = doc(db, "handles", handle);
    const counter = await tx.get(counterRef);
    const taken = await tx.get(handleRef);
    if (taken.exists()) throw new Error("handle-taken");
    const id = Math.max(counter.exists() ? counter.data().nextId : 0, 100);
    tx.set(counterRef, { nextId: id + 1 });
    tx.set(doc(db, "publicIds", String(id)), { uid, createdAt: serverTimestamp() });
    tx.set(handleRef, { uid, createdAt: serverTimestamp() });
    tx.set(doc(db, "users", uid), {
      publicId: String(id), handle, username, avatar: "", bio: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), role: "user", banned: false,
    });
    return String(id);
  });
}

async function seedAdmin(uid) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "config/admins"), { uids: [uid] });
  });
}

function newPost(uid, userId, username, extra = {}) {
  return {
    uid, userId, username, avatar: "", board: "General", boardKey: "general", text: "hello",
    media: null, contentWarnings: [], createdAt: serverTimestamp(), yeahs: [], replyCount: 0, ...extra,
  };
}

// ---------- identity ----------
test("signup allocates sequential public ids starting at 100", async () => {
  assert(await createAccount(dbFor("alice"), "alice", "alice") === "100");
  assert(await createAccount(dbFor("bob"), "bob", "bob") === "101");
});

test("legacy low counter still allocates from 100", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "counters/users"), { nextId: 7 });
  });
  assert(await createAccount(dbFor("alice"), "alice", "alice") === "100");
});

test("handles are unique", async () => {
  await createAccount(dbFor("alice"), "alice", "alice");
  // Skip the client-side check and write the claimed handle directly.
  const m = dbFor("mallory");
  await assertFails(runTransaction(m, async (tx) => {
    tx.set(doc(m, "counters/users"), { nextId: 102 });
    tx.set(doc(m, "publicIds/101"), { uid: "mallory", createdAt: serverTimestamp() });
    tx.set(doc(m, "handles/alice"), { uid: "mallory", createdAt: serverTimestamp() });
    tx.set(doc(m, "users/mallory"), { publicId: "101", handle: "alice", username: "m", createdAt: serverTimestamp() });
  }));
  assert(await createAccount(m, "mallory", "mallory") === "101");
});

test("cannot create a profile with a stolen id, admin role, or without the counter", async () => {
  await createAccount(dbFor("alice"), "alice", "alice");
  const m = dbFor("mallory");
  await assertFails(setDoc(doc(m, "users/mallory"), {
    publicId: "100", handle: "alice", username: "x", createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(m, "publicIds/5000"), { uid: "mallory", createdAt: serverTimestamp() }));
  await assertFails(runTransaction(m, async (tx) => {
    tx.set(doc(m, "counters/users"), { nextId: 102 });
    tx.set(doc(m, "publicIds/101"), { uid: "mallory", createdAt: serverTimestamp() });
    tx.set(doc(m, "handles/mallory"), { uid: "mallory", createdAt: serverTimestamp() });
    tx.set(doc(m, "users/mallory"), {
      publicId: "101", handle: "mallory", username: "m", createdAt: serverTimestamp(), role: "admin",
    });
  }));
});

test("profiles are public; owners edit safe fields only", async () => {
  const a = dbFor("alice");
  await createAccount(a, "alice", "alice");
  await assertSucceeds(getDoc(doc(anon(), "users/alice")));
  await assertSucceeds(updateDoc(doc(a, "users/alice"), { bio: "hi", avatar: "https://x.test/a.png", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(a, "users/alice"), { role: "admin" }));
  await assertFails(updateDoc(doc(a, "users/alice"), { publicId: "1" }));
  await assertFails(updateDoc(doc(a, "users/alice"), { avatar: "javascript:alert(1)" }));
  await assertFails(updateDoc(doc(a, "users/alice"), { avatar: "data:image/png;base64,AAAA" }));
  await assertFails(updateDoc(doc(dbFor("bob"), "users/alice"), { bio: "pwned" }));
});

test("handle change must claim the new handle and release the old one", async () => {
  const a = dbFor("alice");
  await createAccount(a, "alice", "alice");
  await assertFails(updateDoc(doc(a, "users/alice"), { handle: "alice2" }));
  const batch = writeBatch(a);
  batch.set(doc(a, "handles/alice2"), { uid: "alice", createdAt: serverTimestamp() });
  batch.delete(doc(a, "handles/alice"));
  batch.update(doc(a, "users/alice"), { handle: "alice2" });
  await assertSucceeds(batch.commit());
});

test("legacy profiles collection stays private", async () => {
  await assertFails(getDoc(doc(dbFor("alice"), "profiles/0")));
});

// ---------- posts ----------
test("posts: create as yourself only, public read", async () => {
  const a = dbFor("alice");
  await createAccount(a, "alice", "alice", "Alice");
  await assertSucceeds(setDoc(doc(a, "posts/p1"), newPost("alice", "100", "Alice")));
  await assertSucceeds(getDoc(doc(anon(), "posts/p1")));
  await assertFails(setDoc(doc(a, "posts/p2"), newPost("alice", "101", "Alice")));
  await assertFails(setDoc(doc(a, "posts/p3"), newPost("alice", "100", "Somebody Else")));
  await assertFails(setDoc(doc(a, "posts/p4"), newPost("alice", "100", "Alice", { yeahs: ["100"] })));
  await assertFails(setDoc(doc(a, "posts/p5"), newPost("alice", "100", "Alice", { inGame: true })));
  await assertFails(setDoc(doc(anon(), "posts/p6"), newPost("alice", "100", "Alice")));
  await assertFails(setDoc(doc(a, "posts/p7"), newPost("alice", "100", "Alice", {
    media: { type: "image", url: "javascript:alert(1)" },
  })));
});

test("posts: yeah toggles only your own id", async () => {
  const a = dbFor("alice"); const b = dbFor("bob");
  await createAccount(a, "alice", "alice", "Alice");
  await createAccount(b, "bob", "bob", "Bob");
  await setDoc(doc(a, "posts/p1"), newPost("alice", "100", "Alice"));
  await assertSucceeds(updateDoc(doc(b, "posts/p1"), { yeahs: arrayUnion("101") }));
  await assertFails(updateDoc(doc(b, "posts/p1"), { yeahs: arrayUnion("100") }));
  await assertFails(updateDoc(doc(b, "posts/p1"), { yeahs: ["101", "101"] }));
  await assertSucceeds(updateDoc(doc(a, "posts/p1"), { yeahs: arrayUnion("100") }));
  await assertFails(updateDoc(doc(a, "posts/p1"), { yeahs: arrayRemove("101") }));
  await assertSucceeds(updateDoc(doc(b, "posts/p1"), { yeahs: arrayRemove("101") }));
});

test("posts: edit and delete by owner or moderator only", async () => {
  const a = dbFor("alice"); const b = dbFor("bob");
  await createAccount(a, "alice", "alice", "Alice");
  await createAccount(b, "bob", "bob", "Bob");
  await setDoc(doc(a, "posts/p1"), newPost("alice", "100", "Alice"));
  await assertFails(updateDoc(doc(b, "posts/p1"), { text: "edited", editedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(a, "posts/p1"), { text: "edited", editedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(b, "posts/p1")));
  await seedAdmin("bob");
  await assertSucceeds(deleteDoc(doc(b, "posts/p1")));
});

test("replies: replyCount moves only with a matching reply in the same batch", async () => {
  const a = dbFor("alice"); const b = dbFor("bob");
  await createAccount(a, "alice", "alice", "Alice");
  await createAccount(b, "bob", "bob", "Bob");
  await setDoc(doc(a, "posts/p1"), newPost("alice", "100", "Alice"));
  await assertFails(updateDoc(doc(b, "posts/p1"), { replyCount: increment(1), lastReplyId: "nope" }));
  const reply = { uid: "bob", userId: "101", username: "Bob", avatar: "", parentId: null, text: "yo",
    media: null, createdAt: serverTimestamp(), yeahs: [] };
  const batch = writeBatch(b);
  batch.set(doc(b, "posts/p1/replies/r1"), reply);
  batch.update(doc(b, "posts/p1"), { replyCount: increment(1), lastReplyId: "r1", lastReplyAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(b, "posts/p1/replies/r2"), { ...reply, userId: "100" }));
  const del = writeBatch(b);
  del.delete(doc(b, "posts/p1/replies/r1"));
  del.update(doc(b, "posts/p1"), { replyCount: increment(-1), lastReplyId: "r1" });
  await assertSucceeds(del.commit());
});

test("admins can import in-game posts; others cannot", async () => {
  const a = dbFor("alice");
  await createAccount(a, "alice", "alice", "Alice");
  const imported = newPost("alice", "3", "BeeSid", {
    board: "BeeSid", boardKey: "beesid", inGame: true, sourceId: "1785636000000",
    createdAt: Timestamp.fromMillis(1785636000000),
  });
  await assertFails(setDoc(doc(a, "posts/cg1"), imported));
  await seedAdmin("alice");
  await assertSucceeds(setDoc(doc(a, "posts/cg1"), imported));
});

test("banned users cannot post", async () => {
  const a = dbFor("alice"); const m = dbFor("mod");
  await createAccount(a, "alice", "alice", "Alice");
  await createAccount(m, "mod", "moddy", "Mod");
  await seedAdmin("mod");
  await assertSucceeds(updateDoc(doc(m, "users/alice"), { banned: true }));
  await assertFails(setDoc(doc(a, "posts/p1"), newPost("alice", "100", "Alice")));
});

// ---------- follows & notifications ----------
test("follows are created for yourself only", async () => {
  const a = dbFor("alice"); const b = dbFor("bob");
  await createAccount(a, "alice", "alice");
  await createAccount(b, "bob", "bob");
  const f = { follower: "alice", followee: "bob", followerId: "100", followeeId: "101", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(a, "follows/alice_bob"), f));
  await assertFails(setDoc(doc(b, "follows/alice_bob2"), f));
  await assertFails(setDoc(doc(a, "follows/alice_alice"), { ...f, followee: "alice", followeeId: "100" }));
  await assertFails(deleteDoc(doc(b, "follows/alice_bob")));
  await assertSucceeds(deleteDoc(doc(a, "follows/alice_bob")));
});

test("notifications: sender writes, only recipient reads and marks read", async () => {
  const a = dbFor("alice"); const b = dbFor("bob");
  await createAccount(a, "alice", "alice", "Alice");
  await createAccount(b, "bob", "bob", "Bob");
  const n = { type: "yeah", fromUid: "alice", fromUserId: "100", fromName: "Alice", text: "yeah'd your post",
    href: "/b/General/post/p1/comments", read: false, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(a, "users/bob/notifications/n1"), n));
  await assertFails(setDoc(doc(a, "users/bob/notifications/n2"), { ...n, fromUid: "bob" }));
  await assertFails(setDoc(doc(a, "users/alice/notifications/n3"), n));
  await assertFails(getDoc(doc(a, "users/bob/notifications/n1")));
  await assertSucceeds(updateDoc(doc(b, "users/bob/notifications/n1"), { read: true }));
  await assertFails(updateDoc(doc(b, "users/bob/notifications/n1"), { text: "forged" }));
  await setDoc(doc(b, "users/bob/blocked/alice"), { at: serverTimestamp() });
  await assertFails(setDoc(doc(a, "users/bob/notifications/n4"), n));
});

// ---------- direct messages ----------
test("DMs: deterministic id, members only, blocks respected", async () => {
  const a = dbFor("alice"); const b = dbFor("bob"); const c = dbFor("carol");
  await createAccount(a, "alice", "alice");
  await createAccount(b, "bob", "bob");
  await createAccount(c, "carol", "carol");
  const conv = { members: ["alice", "bob"], memberIds: ["100", "101"], group: false, title: "", image: "",
    createdBy: "alice", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: null, lastRead: {} };
  await assertSucceeds(getDoc(doc(a, "conversations/dm_alice_bob")));
  await assertFails(setDoc(doc(a, "conversations/dm_bob_alice"), { ...conv, members: ["bob", "alice"] }));
  await assertSucceeds(setDoc(doc(a, "conversations/dm_alice_bob"), conv));
  await assertFails(getDoc(doc(c, "conversations/dm_alice_bob")));
  const msg = { from: "alice", fromId: "100", text: "hey", media: null, createdAt: serverTimestamp() };
  await assertSucceeds(addDoc(collection(a, "conversations/dm_alice_bob/messages"), msg));
  await assertFails(addDoc(collection(c, "conversations/dm_alice_bob/messages"), { ...msg, from: "carol", fromId: "102" }));
  await assertFails(addDoc(collection(b, "conversations/dm_alice_bob/messages"), msg));
  await assertSucceeds(updateDoc(doc(b, "conversations/dm_alice_bob"), { "lastRead.bob": serverTimestamp() }));
  await assertFails(updateDoc(doc(b, "conversations/dm_alice_bob"), { "lastRead.alice": serverTimestamp() }));
  await setDoc(doc(b, "users/bob/blocked/alice"), { at: serverTimestamp() });
  await assertFails(addDoc(collection(a, "conversations/dm_alice_bob/messages"), msg));
});

// ---------- reports, chipper, config ----------
test("reports: anyone active files, only moderators read", async () => {
  const a = dbFor("alice"); const m = dbFor("mod");
  await createAccount(a, "alice", "alice");
  await createAccount(m, "mod", "moddy");
  const r = { reporter: "alice", reporterId: "100", targetType: "post", targetId: "p1", reason: "spam",
    text: "", status: "open", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(a, "reports/r1"), r));
  await assertFails(getDoc(doc(a, "reports/r1")));
  await seedAdmin("mod");
  await assertSucceeds(getDoc(doc(m, "reports/r1")));
});

test("chipper feed: public read, moderator-only write; config is console-only", async () => {
  const a = dbFor("alice");
  await createAccount(a, "alice", "alice");
  await assertSucceeds(getDoc(doc(anon(), "chipper/feed")));
  await assertFails(setDoc(doc(anon(), "chipper/feed"), { payload: "{}" }));
  await assertFails(setDoc(doc(a, "chipper/feed"), { payload: "{}" }));
  await seedAdmin("alice");
  await assertSucceeds(setDoc(doc(a, "chipper/feed"), { payload: "{}" }));
  await assertFails(setDoc(doc(a, "config/admins"), { uids: ["alice", "x"] }));
});

function assert(cond, msg = "assertion failed") { if (!cond) throw new Error(msg); }
