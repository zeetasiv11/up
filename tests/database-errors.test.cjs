const test = require("node:test");
const assert = require("node:assert/strict");
const { databaseError } = require("../src/database/databaseError");
const { RuntimeRepository } = require("../src/database/repositories/runtimeRepository");

test("runtime startup exposes actionable missing-function diagnostics without provider payloads", async () => {
    const providerError = { code: "PGRST202", message: "private payload", details: "private details" };
    const repository = new RuntimeRepository({ rpc: async () => ({ error: providerError, status: 404 }) });
    await assert.rejects(repository.initialize(), (error) => {
        assert.match(error.message, /runtime_load failed \[PGRST202, HTTP 404\]/);
        assert.match(error.message, /schema.sql.*runtime.sql/);
        assert.doesNotMatch(error.message, /private/);
        assert.equal(error.cause, providerError);
        return true;
    });
    assert.equal(repository.timer, undefined);
});

test("database diagnostics distinguish migration, lease and credentials without leaking arbitrary errors", () => {
    for (const [error, status, expected] of [
        [
            { code: "P0001", message: "Run the legacy migration before starting Supabase runtime" },
            400,
            /npm run db:migrate/,
        ],
        [{ code: "P0001", message: "Another bot instance owns the runtime lease" }, 400, /90 seconds/],
        [{ code: "42501" }, 403, /authentication or permission/],
        [{ message: "Invalid API key" }, 401, /SUPABASE_SERVICE_ROLE_KEY/],
        [
            { code: "secret-in-code", message: "secret-in-message", details: "secret-in-details" },
            "secret-status",
            /UNKNOWN/,
        ],
    ]) {
        const result = databaseError("runtime_load", error, status);
        assert.match(result.message, expected);
        assert.doesNotMatch(result.message, /secret-in|secret-status/);
    }
});
