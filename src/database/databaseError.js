// Provider errors can contain row values or credentials. Only publish fixed
// diagnostics, validated error codes and HTTP status; retain the cause internally.
function databaseError(operation, error, status) {
    const code = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error?.code || "") ? error.code : "UNKNOWN";
    let hint = "Check Supabase availability, project URL and database configuration.";
    if (code === "PGRST202" || code === "42883" || code === "42P01")
        hint =
            "Database schema is incomplete. Apply database/supabase/schema.sql, then database/supabase/runtime.sql in Supabase SQL Editor; reload the API schema cache if already applied.";
    else if (error?.message === "Run the legacy migration before starting Supabase runtime")
        hint =
            "Legacy data has not been migrated. Run npm run db:migrate and npm run db:validate before starting the bot.";
    else if (error?.message === "Another bot instance owns the runtime lease")
        hint =
            "Another bot is using this database. Stop the other instance and wait up to 90 seconds before restarting.";
    else if (
        code === "42501" ||
        status === 401 ||
        status === 403 ||
        ["PGRST301", "PGRST302", "PGRST303"].includes(code)
    )
        hint =
            "Database authentication or permission failed. Check SUPABASE_URL and its matching SUPABASE_SERVICE_ROLE_KEY; use a server secret/service_role key, not an anon/publishable key, and verify schema grants.";
    const http = Number.isInteger(status) && status >= 0 && status <= 599 ? `, HTTP ${status}` : "";
    return new Error(`Database ${operation} failed [${code}${http}]. ${hint}`, { cause: error });
}
module.exports = { databaseError };
