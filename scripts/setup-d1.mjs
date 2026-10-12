// Izveido D1 datubāzi "wolves" (ja vēl nav) un ieraksta tās ID wrangler.jsonc
import { execSync } from "node:child_process";
import fs from "node:fs";
const cfg = "wrangler.jsonc";
let txt = fs.readFileSync(cfg, "utf8");
if (!txt.includes("AIZPILDI_PĒC_wrangler_d1_create")) { console.log("  D1 jau pieslēgta."); process.exit(0); }
const list = () => { try { return JSON.parse(execSync("npx wrangler d1 list --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch (e) { return []; } };
let db = list().find(d => d.name === "wolves");
if (!db) { execSync("npx wrangler d1 create wolves", { stdio: "inherit" }); db = list().find(d => d.name === "wolves"); }
if (!db) { console.error("✖ Neizdevās atrast D1 'wolves'"); process.exit(1); }
fs.writeFileSync(cfg, txt.replace("AIZPILDI_PĒC_wrangler_d1_create", db.uuid));
console.log("  D1 ID:", db.uuid);
