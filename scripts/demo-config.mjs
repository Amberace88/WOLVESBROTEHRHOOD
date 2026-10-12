// No wrangler.jsonc izveido wrangler.demo.json bez domēna maršrutiem (tikai workers.dev)
import fs from "node:fs";
const src = fs.readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "");
const c = JSON.parse(src);
delete c.routes; delete c.$schema;
c.workers_dev = true;
fs.writeFileSync("wrangler.demo.json", JSON.stringify(c, null, 2));
