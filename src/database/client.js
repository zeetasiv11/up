const { createClient } = require("@supabase/supabase-js");
let singleton;
function databaseClient() {
    if (singleton) return singleton;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    singleton = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: (input, init = {}) =>
                fetch(input, { ...init, signal: init.signal || AbortSignal.timeout(30000) }),
        },
    });
    return singleton;
}
module.exports = { databaseClient };
