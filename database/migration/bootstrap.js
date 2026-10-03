const { databaseClient } = require("../../src/database/client");
const { databaseError } = require("../../src/database/databaseError");
const { run } = require("./migrateLegacy");

// Opt-in first deployment only. The persisted receipt prevents replaying the
// archived snapshot against accounts that have changed since the initial import.
async function bootstrap({ client = databaseClient(), migrate = run } = {}) {
    const { data, error, status } = await client.from("legacy_imports").select("source_hash").limit(1);
    if (error) throw databaseError("migration_receipt", error, status);
    if (!Array.isArray(data)) throw new Error("Cannot determine database migration state");
    if (data.length) return { status: "already_initialized" };
    const { report } = await migrate();
    if (report.status !== "complete" || report.verification?.ok !== true)
        throw new Error("Initial database migration was not verified; bot startup stopped");
    return { status: "migrated", counts: report.counts, verified: true };
}
module.exports = { bootstrap };
