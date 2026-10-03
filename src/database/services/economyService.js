const { z } = require("zod");
const { economyRepository } = require("../repositories/economyRepository.js");
const id = z.string().regex(/^\d{17,20}$/);
function createEconomyService(repository = economyRepository()) {
    return {
        async get(userId) {
            return repository.get(id.parse(userId));
        },
        async transfer({ operationId, sender, recipient, amount }) {
            z.string().min(1).max(200).parse(operationId);
            id.parse(sender);
            id.parse(recipient);
            z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(amount);
            if (sender === recipient) throw new Error("Cannot transfer to yourself");
            return repository.transfer(operationId, sender, recipient, amount);
        },
    };
}
module.exports = { createEconomyService };
