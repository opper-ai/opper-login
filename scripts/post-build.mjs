// Copies styles.css into dist/ and re-adds the "./styles.css" export that
// tshy strips when it rewrites package.json. Only rewrites package.json when
// the export is actually missing so repeat builds don't touch the file.

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

copyFileSync(join(root, "src/styles.css"), join(root, "dist/styles.css"));

const pkgPath = join(root, "package.json");
const original = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(original);

if (pkg.exports?.["./styles.css"] !== "./dist/styles.css") {
    pkg.exports = {
        ...pkg.exports,
        "./styles.css": "./dist/styles.css",
    };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");
}
