const SSO = require("../../storage/sso");
const Sessions = require("../../storage/sessions");
const Nacl  = require("tweetnacl/nacl-fast");
const JWT = require("jsonwebtoken");
const Util = require("../../common-util");
const config = require("../../load-config");
const nThen = require("nthen");
const fs = require('node:fs');

const SSOUtils = module.exports;

const SESSION_EXPIRATIION = 12 * 3600 * 1000; // XXX Hours? Days? Weeks? Configurable?



SSOUtils.getOptions = () => {
    return {
        callbackURL: config.httpUnsafeOrigin + '/ssoauth'
    };
};

const TYPES = SSOUtils.TYPES = {};

try {
    let protocolsDir = fs.readdirSync(__dirname + '/protocols');
    protocolsDir.forEach((name) => {
        if (!/.js$/.test(name)) { return; }
        name = name.replace(/.js$/, '');
        TYPES[name] = require(`./protocols/${name}`)(SSOUtils);
    });
} catch (err) { console.error(err); }

const checkConfig = SSOUtils.checkConfig = (Env) => {
    return Env && Env.sso && Env.sso.enabled && Array.isArray(Env.sso.list) && Env.sso.list.length;
};
SSOUtils.getProviderConfig = (Env, provider) => {
    if (!checkConfig(Env)) { return; }
    if (!provider) { return; }
    const data = Env.sso.list.find((cfg) => { return cfg.name === provider; });
    return data;
};
SSOUtils.isValidConfig = (cfg) => {
    if (!cfg) { return; }
    if (!cfg.type) { return; }
    const type = cfg.type.toLowerCase();
    const idp = TYPES[type];
    if (!idp) { return; }
    return idp.checkConfig(cfg);
};

SSOUtils.deleteRequest = (Env, id) => {
    SSO.request.delete(Env, id, (err) => {
        if (!err) { return; }
        console.log(`Failed to delete SSO request ${id}`);
        // XXX log?
    });
};
SSOUtils.readRequest = (Env, id, cb) => {
    SSO.request.read(Env, id, cb);
};
SSOUtils.writeRequest = (Env, data, cb) => {
    if (!data || !data.id || !data.type) { return void cb ('INVALID_REQUEST'); }
    const id = data.id;
    const value = {
        type: data.type,
        register: data.register,
        provider: data.provider,
        publicKey: data.publicKey,
        time: +new Date()
    };
    if (data.content) { value.content = data.content; }

    SSO.request.write(Env, id, JSON.stringify(value), cb);
};

SSOUtils.writeUser = (Env, provider, id, cb) => {
    const seed = Util.encodeBase64(Nacl.randomBytes(24));
    SSO.user.write(Env, provider, id, JSON.stringify({
        seed: seed,
        password: false
    }), (err) => {
        if (err) { return void cb(err); }
        cb(void 0, { seed });
    });
};
SSOUtils.readUser = (Env, provider, id, cb) => {
    SSO.user.read(Env, provider, id, (err, user) => {
        if (err) { return void cb(err); }
        cb(void 0, Util.tryParse(user));
    });
};
SSOUtils.deleteUser = (Env, provider, id, cb) => {
    SSO.user.archive(Env, provider, id, cb);
};
SSOUtils.updateUser = (Env, provider, id, data, cb) => {
    SSO.user.archive(Env, provider, id, () => {
        SSO.user.write(Env, provider, id, JSON.stringify(data), (err) => {
            if (err) { return void cb(err); }
            cb();
        });
    });
};

SSOUtils.writeBlock = (Env, id, provider, ssoID, cb) => {
    SSO.block.write(Env, id, JSON.stringify({
        id: ssoID,
        provider: provider
    }), (err) => {
        if (err) { return void cb(err); }
        cb();
    });
};
SSOUtils.readBlock = (Env, id, cb) => {
    SSO.block.read(Env, id, (err, blockData) => {
        if (err && err !== 'ENOENT' && err.code !== 'ENOENT') {
            Env.Log.error("SSO_READ_BLOCK", {
                error: Util.serializeError(err),
                publicKey: id
            });
        }
        if (err) { return void cb(err.code || err); }
        cb(void 0, Util.tryParse(blockData));
    });
};
SSOUtils.deleteBlock = (Env, id, cb) => {
    SSO.block.archive(Env, id, (err) => {
        if (err) { return void cb(err); }
        cb();
    });
};

// Archive SSO account data
SSOUtils.deleteAccount = (Env, publicKey, cb) => {
    SSOUtils.readBlock(Env, publicKey, (err, data) => {
        if (err && err !== 'ENOENT') { return void cb(err); }
        if (!data) { return void cb(); }
        let provider = data.provider;
        let userId = data.id;
        nThen((w) => {
            SSOUtils.deleteUser(Env, provider, userId, w((err) => {
                Env.Log.error("SSO_DELETE_USER", {
                    error: Util.serializeError(err),
                    provider: provider,
                    id: userId
                });
            }));
            SSOUtils.deleteBlock(Env, publicKey, w());
        }).nThen(() => {
            cb();
        });
    });
};
SSOUtils.restoreAccount = (Env, publicKey, cb) => {
    SSO.block.restore(Env, publicKey, (err) => {
        if (err && err.code === 'ENOENT') { return void cb(); }
        if (err) { return void cb(err); }
        SSOUtils.readBlock(Env, publicKey, (err, data) => {
            let provider = data.provider;
            let userId = data.id;
            SSO.user.restore(Env, provider, userId, (err) => {
                cb(err);
            });
        });
    });
};


// Store the SSO data (tokens, etc.) in a JWT while waiting for the user's CryptPad password
SSOUtils.createJWT = (Env, ssoId, provider, data, cb) => {
    JWT.sign({
        sub: ssoId,
        data: data,
        provider: provider
    }, Env.bearerSecret, {
        // token integrity is ensured with HMAC SHA512 with the server's bearerSecret
        // clients can inspect token parameters, but cannot modify them
        algorithm: 'HS512',
        // if you want it to expire you can set this for an arbitrary number of seconds in the future
        expiresIn: 300,
    }, function (err, token) {
        if (err) { return void cb(err); }
        cb(void 0, token);
    });
};
SSOUtils.checkJWT = (Env, token, cb) => {
    JWT.verify(token, Env.bearerSecret, {
        algorithm: 'HS512',
    }, function (err, payload) {
        if (err) {
            // the token could not be validated for some reason.
            // it might have expired, the server might have rotated secrets,
            // it might not be well-formed, etc.
            // log and respond.
            Env.Log.info('INVALID_JWT', {
                error: err,
                token: token,
            });
            return void cb('INVALID_JWT');
        }

        // otherwise, it seems basically correct.
        Env.Log.verbose("VALID_JWT", payload);

        cb(void 0, payload);
    });

};

SSOUtils.makeSession = (Env, publicKey, provider, ssoData, cb) => {
    const sessionId = Sessions.randomId();
    Sessions.write(Env, publicKey, sessionId, JSON.stringify({
        sso: {
            exp: +new Date() + SESSION_EXPIRATIION,
            provider: provider,
            data: ssoData
        }
    }), function (err) {
        if (err) {
            Env.Log.error("SSO_SESSION_WRITE", {
                error: Util.serializeError(err),
                publicKey: publicKey,
                sessionId: sessionId,
            });
            return void cb("SSO_NO_SESSION");
        }
        cb(void 0, {
            bearer: sessionId,
        });
    });

};

