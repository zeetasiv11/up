require("./isolate.cjs");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
function load(file, overrides = {}, globals = {}) {
    const absolute = path.join(root, file),
        real = createRequire(absolute),
        module = { exports: {} };
    const require = Object.assign((id) => (Object.hasOwn(overrides, id) ? overrides[id] : real(id)), {
        cache: real.cache,
        resolve: real.resolve,
    });
    vm.runInNewContext(
        fs.readFileSync(absolute, "utf8"),
        {
            module,
            exports: module.exports,
            require,
            __dirname: path.dirname(absolute),
            __filename: absolute,
            console,
            Buffer,
            process,
            structuredClone,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            ...globals,
        },
        { filename: absolute },
    );
    return module.exports;
}
const silent = { info() {}, error() {}, warn() {}, economy() {}, game() {} };
module.exports = { load, silent, root };
