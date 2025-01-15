const SSODecrees = require('./decrees');
const Path = require('node:path');
const Express = require('express');
const nThen = require('nthen');

const SSO = {};

let config = {};
try {
    config = require("../../../config/sso");
} catch (e) {
    console.log("SSO config not found", e);
}


SSO.challenge = require('./challenge');
SSO.utils = require('./sso-utils');
SSO.types = SSO.utils.TYPES;
SSO.config = config;

SSO.addAdminCommands = (/*Env*/) => {
    const commands = {};

    commands.ADD_SSO_DECREE = (Env, Server, cb, data, unsafeKey) => {
        Env.Log.verbose('SSO_ADMIN_DECREE_RECEIVED', data);
        const value = data[1];
        const command = value[0];
        const args = value[1];

        const decree = [command, args, unsafeKey, +new Date()];
        let changed;
        try {
            changed = SSODecrees.handleCommand(Env, decree) || false;
        } catch (err) {
            return void cb(err);
        }

        if (!changed) { return void cb(); }
        Env.Log.info('SSO_ADMIN_DECREE', decree);
        let _err;
        nThen((waitFor) => {
            SSODecrees.write(Env, decree, waitFor((err) => {
                _err = err;
                Env.flushCache();
            }));
            setTimeout(waitFor(), 300); // NOTE: 300 because cache update may take up to 250ms
        }).nThen(function () {
            cb(_err);
        });
    };
    commands.LIST_SSO = (Env, Server, cb) => {
        cb(void 0, Env.sso);
    };

    return commands;
};

SSO.initialize = (Env, type) => {
    // XXX flushCache enough to propagate to http-worker?
    if (type !== "main") { return; }
    SSODecrees.load(Env, err => {
        Env.flushCache();
        if (err) {
            return Env.Log?.error('ERROR_LOADING_SSO_DECREE', err);
        }
    });
};

SSO.addHttpEndpoints = (Env, app) => {
    let dir = Path.join(__dirname, 'client');
    app.use('/sso', Express.static(dir));
};

module.exports = {
  name: "SSO",
  modules: SSO
};
