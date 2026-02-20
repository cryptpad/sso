const Path = require('node:path');
const Express = require('express');

const SSODecrees = require('./decrees');
const Challenge = require('./challenge');

const PLUGIN_NAME = "SSO";
const SSO = {};

const DECREE_NAME = 'sso.ndjson';

let config = {};
try {
    config = require("../../config/sso");
} catch (e) {
    //console.log("SSO config not found");
}


SSO.utils = require('./sso-utils');
SSO.config = config;

SSO.challenges = Object.keys(Challenge.Commands);

SSO.addAdminCommands = (Env, commands) => {
    commands.ADD_SSO_DECREE = (Env, unsafeKey, data, cb) => {
        Env.Log.verbose('SSO_ADMIN_DECREE_RECEIVED', data);

        const value = data[1];
        if (!Array.isArray(value)) { return void cb('INVALID_DECREE'); }
        const command = value[0];
        const args = value[1];

        const decree = [command, args, unsafeKey, +new Date()];
        // Send to storage:0
        Env.interface.sendQuery('storage:0', 'SSO_DECREE', decree, response => {
            cb(response.error, response.data);
            if (response.error) { return; }
            Env.Log.info('SSO_ADMIN_DECREE', decree);
        });
    };
    commands.LIST_SSO = (Env, unsafeKey, data, cb) => {
        cb(void 0, Env.sso);
    };
};

SSO.addStorageCommands = (Env, commands) => {
    // commands from users
    SSO.challenges.forEach(cmd => {
        const f = Challenge.Commands[cmd];
        if (typeof(f) !== "function" || !f.complete) {
            return;
        }
        commands[cmd] = (args, cb) => {
            return f(Env, args, cb);
        };
        commands[`${cmd}_COMPLETE`] = (args, cb) => {
            return f.complete(Env, args, (err, res) => {
                if (err) { console.trace(err); }
                cb(err, res);
            });
        };
    });

    // commands from other storages
    commands.SSO_CMD = (args, cb) => {
        const cmd = args?.cmd;
        if (!cmd) { return void cb('EINVAL_CMD'); }
        if (cmd === 'WRITE_REQUEST') {
            return void SSO.utils.writeRequest(Env, args.data, cb, true);
        }
        if (cmd === 'READ_REQUEST') {
            return void SSO.utils.readRequest(Env, args.id, cb, true);
        }
        if (cmd === 'DELETE_REQUEST') {
            return void SSO.utils.deleteRequest(Env, args.id, cb, true);
        }
        if (cmd === 'WRITE_USER') {
            return void SSO.utils.writeUser(Env, args.provider, args.id, cb, true);
        }
        if (cmd === 'READ_USER') {
            return void SSO.utils.readUser(Env, args.provider, args.id, cb, true);
        }
        if (cmd === 'DELETE_USER') {
            return void SSO.utils.deleteUser(Env, args.provider, args.id, cb, true);
        }
        if (cmd === 'UPDATE_USER') {
            return void SSO.utils.updateUser(Env, args.provider, args.id, args.data, cb, true);
        }
        if (cmd === 'READ_BLOCK') {
            return void SSO.utils.readBlock(Env, args.id, cb, true);
        }
    };

    commands.SSO_DECREE = (decree, cb) => {
        if (Env.myId !== "storage:0") { return void cb('EINVAL'); }
        Env.modules?.Decrees?.onNewDecree(Env, decree, PLUGIN_NAME, cb);
    };
};

SSO.initStorage = (Env, waitFor) => {
    if (Env.myId === "storage:0") {
        // TODO: load decrees
        Env.ssoDecrees.load(Env, waitFor((err, toSend) => {
            Env.sendDecrees(toSend, PLUGIN_NAME);
        }));
    }
};

const addStorageEndpoint = (Env, app) => {
    const Util = Env?.modules?.Util;
    if (!Util) { throw new Error('Missing Env.modules.Util'); }

    app.use('/ssoauth', (req, res, next) => {
        if (req?.body?.SAMLResponse) {
            req.method = 'GET';

            let token = Util.uid();
            let smres = req.body.SAMLResponse;
            return SSO.utils.writeRequest(Env, {
                id: token,
                type: 'saml',
                content: smres
            }, (err) => {
                if (err) {
                    Env.Log.error('E_SSO_WRITE_REQ', err);
                    return res.sendStatus(500);
                }
                let value = `samltoken="${token}"; SameSite=Strict; HttpOnly`;
                res.setHeader('Set-Cookie', value);
                next();
            });

        }
        next();
    });
    let ssoauth = Path.join(__dirname, '../..', Env.clientRoot, 'www', 'ssoauth');
    app.use('/ssoauth', Express.static(ssoauth));
};

SSO.httpEndpoints = [{
    type: 'http',
    f: (Env, app) => {
        let dir = Path.join(__dirname, 'client');
        app.use('/sso', Express.static(dir));
    }
}, {
    type: 'proxy',
    target: 'storage',
    url: '/ssoauth',
    f: addStorageEndpoint,
    getIdFromReq: () => {
        // return an id used with consistent hash to determine the correct storage node
        return String(+new Date());
    }
}];

SSO.customizeEnv = (Env) => {
    const DecreesCore = Env.modules.DecreesCore;

    Challenge.setModules(Env);
    SSO.utils.setModules(Env);

    Env.sso ||= {}; // XXX use initial config static file
    Env.ssoDecrees = DecreesCore.create(DECREE_NAME, SSODecrees);
};

SSO.getDecree = (Env) => {
    return Env.ssoDecrees;
};

module.exports = {
  name: PLUGIN_NAME,
  modules: SSO
};
