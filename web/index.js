require("../settings");
const { startDashboard } = require("./backend/server");
if (require("../utils/database").status().backend === "supabase")
    throw new Error(
        "Standalone web is a login shell; run WEB_ENABLED=true npm start for the shared Supabase runtime.",
    );
const server = startDashboard(null);
for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
        server.close();
        server.closeAllConnections();
    });
