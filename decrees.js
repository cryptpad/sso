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
    if (config?.force === enforce) { return false; }
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


module.exports = DecreesCore.create(DECREE_NAME, commands);
