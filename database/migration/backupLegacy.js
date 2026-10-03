const fs = require("node:fs/promises");
const path = require("node:path");
const { hash } = require("./normalizeLegacy.js");
async function backupLegacy(filename, directory) {
    const bytes = await fs.readFile(filename);
    const digest = hash(bytes);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const destination = path.join(directory, `database-${digest}.json`);
    try {
        await fs.writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (hash(await fs.readFile(destination)) !== digest)
            throw new Error("Existing backup checksum mismatch");
    }
    return { bytes, digest, destination };
}
module.exports = { backupLegacy };
