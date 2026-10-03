const test = require("node:test");
const assert = require("node:assert/strict");
const { bootstrap } = require("../database/migration/bootstrap");
const receiptClient = (result) => ({
    from(table) {
        assert.equal(table, "legacy_imports");
        return {
            select(column) {
                assert.equal(column, "source_hash");
                return {
                    limit: async (n) => {
                        assert.equal(n, 1);
                        return result;
                    },
                };
            },
        };
    },
});

test("bootstrap imports and verifies once, but never replays the snapshot into an initialized database", async () => {
    let calls = 0;
    const migrate = async () => {
        calls++;
        return { report: { status: "complete", verification: { ok: true }, counts: { users: 2 } } };
    };
    assert.deepEqual(await bootstrap({ client: receiptClient({ data: [] }), migrate }), {
        status: "migrated",
        counts: { users: 2 },
        verified: true,
    });
    assert.deepEqual(
        await bootstrap({ client: receiptClient({ data: [{ source_hash: "existing" }] }), migrate }),
        { status: "already_initialized" },
    );
    assert.equal(calls, 1);
});

test("bootstrap fails closed for unreadable receipts, rejected imports and unverified data", async () => {
    const migrate = async () => {
        throw new Error("must not import");
    };
    await assert.rejects(
        bootstrap({ client: receiptClient({ error: { code: "42501" }, status: 403 }), migrate }),
        /authentication or permission/,
    );
    await assert.rejects(bootstrap({ client: receiptClient({ data: null }), migrate }), /Cannot determine/);
    await assert.rejects(bootstrap({ client: receiptClient({ data: [] }), migrate }), /must not import/);
    await assert.rejects(
        bootstrap({
            client: receiptClient({ data: [] }),
            migrate: async () => ({ report: { status: "complete", verification: { ok: false } } }),
        }),
        /not verified/,
    );
});
