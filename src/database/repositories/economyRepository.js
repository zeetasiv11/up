const { databaseClient } = require("../client.js");
function economyRepository(client = databaseClient()) {
    return {
        async get(userId) {
            const { data, error } = await client
                .from("user_economy")
                .select("balance,bank,data")
                .eq("user_id", userId)
                .maybeSingle();
            if (error) throw new Error("Could not read account", { cause: error });
            return data;
        },
        async transfer(operationId, sender, recipient, amount) {
            const { data, error } = await client.rpc("transfer_balance", {
                operation_id: operationId,
                sender,
                recipient,
                amount,
            });
            if (error) throw new Error("Transfer rejected", { cause: error });
            return data;
        },
    };
}
module.exports = { economyRepository };
