const { execFileSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");
function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (["node_modules", ".git"].includes(entry.name)) continue;
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(filename);
        else if (/\.(?:c?js)$/.test(entry.name))
            execFileSync(process.execPath, ["--check", filename], { stdio: "inherit" });
    }
}
walk(path.resolve(__dirname, ".."));
console.log("JavaScript syntax checks passed.");
