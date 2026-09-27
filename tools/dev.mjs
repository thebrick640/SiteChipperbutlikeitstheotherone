#!/usr/bin/env node
// Starts the Firebase emulators (Auth, Firestore, Storage) and the dev server
// together. Emulator data persists in .emulator-data between runs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, ".emulator-data");
const PROJECT = process.env.CB_PROJECT || "demo-coolbrador";
const PORT = process.env.PORT || "8000";
const extra = process.argv.slice(2);

const serverCmd = ["node", "tools/dev-server.mjs", "--emulators", "--port", PORT, "--project", PROJECT, ...extra].join(" ");
const hasData = fs.existsSync(path.join(DATA, "firebase-export-metadata.json"));
const canSeed = fs.existsSync(path.join(ROOT, "tools", "seed-emulator.mjs"));
// emulators:exec runs its command through a shell, so && chaining works.
const execCmd = !hasData && canSeed ? `node tools/seed-emulator.mjs && ${serverCmd}` : serverCmd;

const fbArgs = ["emulators:exec", "--project", PROJECT, "--only", "auth,firestore,storage"];
if (hasData) fbArgs.push("--import", DATA);
fbArgs.push("--export-on-exit", DATA, execCmd);

const localBin = path.join(ROOT, "node_modules", ".bin", "firebase");
const bin = fs.existsSync(localBin) ? localBin : "firebase";
const child = spawn(bin, fbArgs, { cwd: ROOT, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
