const DecreesCore = require('../../decrees-core');
const DECREE_NAME = 'sso.ndjson';

const commands = {};

const {
    args_isBoolean,
    /*args_isString,
    args_isInteger,
    args_isPositiveInteger*/
} = DecreesCore.Utils;


commands.ENABLE_SSO = function (Env, args) {
    if (!args_isBoolean(args)) {
        throw new Error("INVALID_ARGS");
    }

    const enable = args[0];
    const config = Env.sso;
    if (config?.enabled === !!enable) { return false; }
    config.enabled = enable;
    return true;
};


module.exports = DecreesCore.create(DECREE_NAME, commands);
