const { databaseClient } = require("../client.js");
const { databaseError } = require("../databaseError.js");
const { normalizeLegacy } = require("../../../database/migration/normalizeLegacy.js");
async function migrate(source, fingerprint, client = databaseClient()) {
    const normalized = normalizeLegacy(source);
    const { data, error, status } = await client.rpc("import_legacy", {
        source_hash: fingerprint,
        payload: normalized.rows,
        original: source,
    });
    if (error) throw databaseError("import_legacy", error, status);
    return { ...normalized, report: data };
}
async function validate(rows, client = databaseClient()) {
    const { data, error, status } = await client.rpc("verify_legacy", { payload: rows });
    if (error) throw databaseError("verify_legacy", error, status);
    return data;
}
module.exports = { migrate, validate };
