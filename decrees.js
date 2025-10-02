const DecreesCore = require('../../decrees-core');
const DECREE_NAME = 'sso.ndjson';

const commands = {};

const {
    args_isBoolean,
    args_isInteger,
    /*args_isString,
    args_isPositiveInteger*/
} = DecreesCore.Utils;


commands.ENABLE_SSO = function (Env, args) {
    if (!args_isBoolean(args)) {
        throw new Error("INVALID_ARGS");
    }

    const enable = !!args[0];
    const config = Env.sso;
    if (config?.enabled === enable) { return false; }
    config.enabled = enable;
    return true;
};
commands.ENFORCE_SSO = function (Env, args) {
    if (!args_isBoolean(args)) {
        throw new Error("INVALID_ARGS");
    }

    const enforce = !!args[0];
    const config = Env.sso;
    if (config?.enforced === enforce) { return false; }
    config.enforced = enforce;
    return true;
};
commands.PASSWORD_SSO = function (Env, args) {
    if (!args_isInteger(args)) {
        throw new Error("INVALID_ARGS");
    }

    const value = Number(args[0]) || 0;
    const config = Env.sso;

    const oldCp = config.cpPassword;
    const oldForce = config.forceCpPassword;

    const newCp = Boolean(value);
    const newForce = value === 2;

    if (oldCp === newCp && oldForce === newForce) { return false; }

    config.cpPassword = newCp;
    config.forceCpPassword = newForce;
    return true;
};
commands.UPDATE_PROVIDER = function (Env, args) {
    if (typeof(args) !== "object" || !args) {
        throw new Error("INVALID_ARGS");
    }
    if (typeof(args.id) !== "string") {
        throw new Error("INVALID_ARGS");
    }
    const config = Env.sso;
    config.list = config.list || [];

    const id = args.id;
    const value = args.value;
    const exists = config.list.find(data => {
        return data.name === id;
    });
    const idx = exists && config.list.indexOf(exists);

    // Remove provider
    if (value === false) {
        if (!exists) { return false; } // No change
        config.list.splice(idx, 1);
        return true;
    }

    // Not a removal: make sure value exists and id is valid
    if (!value || value.name !== id) {
        throw new Error("INVALID_ARGS");
    }

    // Add provider
    if (!exists) {
        // Make sure id doesn't contain invalid characters
        if (/[^a-zA-Z-_ ]+/.test(id)) {
            throw new Error("INVALID_ARGS");
        }
        config.list.push(value);
        return true;
    }

    // Edit provider
    config.list.splice(idx, 1, value);

    return true;
};


module.exports = DecreesCore.create(DECREE_NAME, commands);
