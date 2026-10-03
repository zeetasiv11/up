const path = require("node:path");
const fs = require("node:fs/promises");
const { backupLegacy } = require("./backupLegacy.js");
const { normalizeLegacy } = require("./normalizeLegacy.js");
const service = require("../../src/database/services/migrationService.js");
async function run({
    source = path.resolve(__dirname, "../database.json"),
    directory = path.resolve(__dirname, "../legacy"),
    dryRun = false,
} = {}) {
    const backup = await backupLegacy(source, directory);
    const report = {
        schemaVersion: 1,
        fingerprint: backup.digest,
        mode: dryRun ? "dry-run" : "import",
        backup: backup.destination,
        timestamp: new Date().toISOString(),
        status: "validating",
    };
    const reportPath = path.join(directory, `report-${backup.digest}-${dryRun ? "dry-run" : "import"}.json`);
    try {
        let parsed;
        try {
            parsed = JSON.parse(backup.bytes.toString("utf8"));
        } catch (error) {
            throw new Error("Legacy JSON invalid; original file and backup retained", { cause: error });
        }
        const normalized = normalizeLegacy(parsed);
        report.counts = normalized.counts;
        if (!dryRun) {
            report.status = "importing";
            const result = await service.migrate(parsed, backup.digest);
            report.database = result.report;
            report.status = "verifying";
            report.verification = await service.validate(normalized.rows);
            if (!report.verification.ok)
                throw new Error("Imported rows differ from source; inspect database before cutover");
        }
        report.status = "complete";
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
        return { reportPath, report };
    } catch (error) {
        report.failedAt = report.status;
        report.status = "failed";
        // Aggregate status only: provider errors or malformed source may include private data.
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 }).catch(() => {});
        throw error;
    }
}
if (require.main === module) {
    try {
        process.loadEnvFile();
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== "--dry-run")) throw new Error("Usage: npm run db:migrate -- [--dry-run]");
    run({ dryRun: args.includes("--dry-run") })
        .then(({ reportPath, report }) =>
            console.log(JSON.stringify({ reportPath, mode: report.mode, counts: report.counts })),
        )
        .catch((error) => {
            console.error(error.message);
            process.exitCode = 1;
        });
}
module.exports = { run };
