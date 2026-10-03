const fs = require("node:fs/promises");
const path = require("node:path");
const { normalizeLegacy } = require("./normalizeLegacy.js");
const { validate } = require("../../src/database/services/migrationService.js");
async function main() {
    try {
        process.loadEnvFile();
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    const source = JSON.parse(await fs.readFile(path.resolve(__dirname, "../database.json"), "utf8"));
    const report = await validate(normalizeLegacy(source).rows);
    console.log(JSON.stringify(report));
    if (!report.ok) process.exitCode = 1;
}
if (require.main === module)
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
