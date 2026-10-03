const equalizer = (gain) => [0, 1, 2].map((band) => ({ band, gain }));
const PRESETS = {
    bassboost: { equalizer: equalizer(0.2) },
    nightcore: { timescale: { speed: 1.15, pitch: 1.15, rate: 1 } },
    vaporwave: { timescale: { speed: 0.85, pitch: 0.85, rate: 1 } },
    "8d": { rotation: { rotationHz: 0.2 } },
    karaoke: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } },
    tremolo: { tremolo: { frequency: 2, depth: 0.5 } },
    vibrato: { vibrato: { frequency: 2, depth: 0.5 } },
    rotation: { rotation: { rotationHz: 0.1 } },
    soft: { lowPass: { smoothing: 20 } },
    lowpass: { lowPass: { smoothing: 20 } },
    pop: {
        equalizer: [
            { band: 0, gain: 0.15 },
            { band: 10, gain: 0.1 },
        ],
    },
    treble: {
        equalizer: [
            { band: 12, gain: 0.15 },
            { band: 13, gain: 0.15 },
        ],
    },
    distortion: {
        distortion: {
            sinOffset: 0,
            sinScale: 1,
            cosOffset: 0,
            cosScale: 1,
            tanOffset: 0,
            tanScale: 1,
            offset: 0,
            scale: 0.5,
        },
    },
    equalizer: { equalizer: equalizer(0.1) },
};
class AudioFilters {
    constructor(queue) {
        this.queue = queue;
        this.active = new Map();
    }
    has(name) {
        return this.active.has(name);
    }
    supports(name) {
        return (
            Object.hasOwn(PRESETS, name) &&
            Object.keys(PRESETS[name]).every((key) => this.queue.player.node.info?.filters?.includes(key))
        );
    }
    async apply(next) {
        let filters = {};
        for (const config of next.values()) filters = { ...filters, ...config };
        await this.queue.player.setFilters(filters);
        this.active = next;
        await this.queue.manager.notify(this.queue);
    }
    add(value) {
        const name = typeof value === "string" ? value : value.name;
        if (!this.supports(name)) return Promise.reject(new Error("Efek tidak didukung node ini."));
        const config =
            name === "bassboost" && typeof value === "object"
                ? { equalizer: equalizer(Math.min(0.5, Math.max(0, Number(value.value)))) }
                : PRESETS[name];
        return this.queue.manager.run(this.queue.id, () =>
            this.apply(new Map(this.active).set(name, config)),
        );
    }
    set(name) {
        if (!this.supports(name)) return Promise.reject(new Error("Efek tidak didukung node ini."));
        return this.queue.manager.run(this.queue.id, () => this.apply(new Map([[name, PRESETS[name]]])));
    }
    remove(name) {
        return this.queue.manager.run(this.queue.id, () => {
            const next = new Map(this.active);
            next.delete(name);
            return this.apply(next);
        });
    }
    clear() {
        return this.queue.manager.run(this.queue.id, () => this.apply(new Map()));
    }
}
module.exports = { AudioFilters, PRESETS };
