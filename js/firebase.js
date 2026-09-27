// Firebase bootstrap shared by every page (plain ES modules from the CDN, no bundler).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcxFPQU10CvAR8aEas54DEo7foxynsaeM",
  authDomain: "coolbrador.firebaseapp.com",
  projectId: "coolbrador",
  storageBucket: "coolbrador.firebasestorage.app",
  messagingSenderId: "295802425127",
  appId: "1:295802425127:web:fe68d85c00311cec25a302",
  measurementId: "G-HFHWZP631W"
};

// Injected only by `npm run dev` (tools/dev-server.mjs --emulators). The dev
// server proxies the emulators on this same origin, so https previews work.
export const EMULATOR = (typeof window !== "undefined" && window.__CB_EMULATOR__) || null;
if (EMULATOR) {
  firebaseConfig.projectId = EMULATOR.projectId;
  firebaseConfig.storageBucket = EMULATOR.projectId + ".appspot.com";
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
if (EMULATOR) connectAuthEmulator(auth, location.origin, { disableWarnings: true });

export const db = initializeFirestore(app, EMULATOR
  ? { host: location.host, ssl: location.protocol === "https:", experimentalForceLongPolling: true, ignoreUndefinedProperties: true }
  : { ignoreUndefinedProperties: true });

let storagePromise = null;
export function getStorageInstance() {
  if (!storagePromise) {
    storagePromise = import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js").then((m) => {
      const storage = m.getStorage(app);
      if (EMULATOR) {
        const port = Number(location.port) || (location.protocol === "https:" ? 443 : 80);
        m.connectStorageEmulator(storage, location.hostname, port);
        // connectStorageEmulator forces http; the same-origin proxy may be https.
        storage._protocol = location.protocol.replace(":", "");
      }
      return storage;
    });
  }
  return storagePromise;
}
