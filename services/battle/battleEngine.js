/**
 * ============================================
 *  BATTLE ENGINE
 *  Turn-based, deterministic-per-call simulation (bukan mock):
 *  benar-benar menghitung damage tiap giliran berdasarkan ATK/DEF/SPD
 *  sampai salah satu HP habis atau max 30 turn.
 * ============================================
 */

function clampDamage(atk, def) {
    const base = Math.max(1, atk - def * 0.5);
    const variance = base * (0.85 + Math.random() * 0.3); // ±15%
    const crit = Math.random() < 0.12;
    return { damage: Math.max(1, Math.round(variance * (crit ? 1.5 : 1))), crit };
}

/**
 * @param {{name:string, hp:number, atk:number, def:number, spd:number}} a
 * @param {{name:string, hp:number, atk:number, def:number, spd:number}} b
 * @returns {{ winner: "a"|"b"|"draw", log: string[], turns: number }}
 */
function simulate(a, b) {
    const fighterA = { ...a, curHp: a.hp };
    const fighterB = { ...b, curHp: b.hp };
    const log = [];

    // Yang SPD lebih tinggi menyerang duluan tiap ronde
    let turn = 0;
    while (fighterA.curHp > 0 && fighterB.curHp > 0 && turn < 30) {
        turn++;
        const order = fighterA.spd >= fighterB.spd ? [fighterA, fighterB] : [fighterB, fighterA];
        for (const attacker of order) {
            const defender = attacker === fighterA ? fighterB : fighterA;
            if (defender.curHp <= 0) continue;
            const { damage, crit } = clampDamage(attacker.atk, defender.def);
            defender.curHp = Math.max(0, defender.curHp - damage);
            log.push(`${crit ? "💥 CRIT! " : ""}${attacker.name} menyerang ${defender.name} — **${damage}** damage (HP ${defender.name}: ${defender.curHp}/${defender.hp})`);
            if (defender.curHp <= 0) break;
        }
    }

    let winner = "draw";
    if (fighterA.curHp <= 0 && fighterB.curHp <= 0) winner = "draw";
    else if (fighterB.curHp <= 0) winner = "a";
    else if (fighterA.curHp <= 0) winner = "b";
    else winner = fighterA.curHp >= fighterB.curHp ? "a" : "b"; // turn limit reached -> sisa HP lebih besar menang

    return { winner, log, turns: turn, finalA: fighterA.curHp, finalB: fighterB.curHp };
}

const NPC_MONSTERS = [
    { name: "Goblin Scout", hp: 60, atk: 10, def: 5, spd: 8, reward: 400, xp: 30 },
    { name: "Cave Troll", hp: 140, atk: 18, def: 10, spd: 5, reward: 900, xp: 60 },
    { name: "Dark Assassin", hp: 90, atk: 22, def: 6, spd: 16, reward: 1100, xp: 70 },
    { name: "Stone Golem", hp: 220, atk: 20, def: 22, spd: 3, reward: 1800, xp: 100 },
    { name: "Ancient Dragon", hp: 400, atk: 40, def: 25, spd: 14, reward: 4000, xp: 220 }
];

function rollNpc() {
    return NPC_MONSTERS[Math.floor(Math.random() * NPC_MONSTERS.length)];
}

module.exports = { simulate, rollNpc, NPC_MONSTERS };
