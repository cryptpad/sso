const OID = require('openid-client');

const TYPE = 'oidc';

module.exports = (SSOUtils) => {
    const opts = SSOUtils.getOptions();
    let clients = {};
    const getClient = (Env, cfg, cb) => {
        if (clients[cfg.name]) {
            return void cb(void 0, clients[cfg.name]);
        }

        Env.Log.verbose('DISCOVER_OPENID_ISSUER', {name:cfg.name, url:cfg.url});
        OID.Issuer.discover(cfg.url).then((issuer) => {
            Env.Log.verbose('DISCOVERED_OPENID_ISSUER', {name:cfg.name});

            let id_alg = cfg.id_token_alg || cfg.jwt_alg || 'PS256';
            let user_alg = cfg.userinfo_token_alg || cfg.jwt_alg || 'PS256';

            // ID token alg supported
            let its = issuer.id_token_signing_alg_values_supported;
            if (Array.isArray(its) && !its.includes(id_alg)) { id_alg = its[0]; }

            // Userinfo alg supported
            let uis = issuer.userinfo_signing_alg_values_supported;
            if (Array.isArray(uis) && !uis.includes(user_alg)) { user_alg = uis[0]; }

            Env.Log.verbose('CREATE_OPENID_CLIENT', {name:cfg.name, id_alg, user_alg});
            const client = clients[cfg.name] = new issuer.Client({
                client_id: cfg.client_id,
                client_secret: cfg.client_secret,
                redirect_uris: [opts.callbackURL],
                response_types: ['code'],
                id_token_signed_response_alg: id_alg,
                userinfo_signed_response_alg: user_alg
            });
            cb(void 0, client);
        }, (err) => {
            Env.Log.error('OPENID_CLIENT_ERROR', err);
            cb(err);
        });
    };
    return {
        type: TYPE,
        checkConfig: (cfg) => {
            return cfg.url && cfg.client_id && cfg.client_secret;
        },
        auth: (Env, cfg, cb) => {
            Env.Log.verbose('NEW_OPENID_REQUEST', {name:cfg.name});
            getClient(Env, cfg, (err, client) => {
                if (err) { return void cb ('E_OIDC_CONNECT'); }
                let username_scope = cfg.username_scope || 'profile';
                let email_scope = cfg.email_scope || ''; // This is not yet used
                let extra_scope = cfg.extra_scope || ''; // This is not yet used

                let config = {
                    scope: `openid ${username_scope} ${email_scope} ${extra_scope}`,
                    //resource: opts.callbackURL,
                    //access_type: 'offline',
                    state: Math.random().toString(36), // Just create a state for providers that require it...
                };

                // Security
                let use_pkce = !(cfg.use_pkce === false);
                let use_nonce = !(cfg.use_nonce === false);

                const generators = OID.generators;
                const code_verifier = generators.codeVerifier();
                const code_challenge = generators.codeChallenge(code_verifier);
                const nonce = generators.nonce();

                if (use_pkce) {
                    config.code_challenge = code_challenge;
                    config.code_challenge_method = 'S256';
                }
                if (use_nonce) {
                    config.nonce = nonce;
                }

                // Make URL
                const url = client.authorizationUrl(config);
                Env.Log.debug('OPENID_AUTH_URL', {name:cfg.name, url});

                cb(void 0, { url: url, token: code_verifier, nonce });
            });
        },
        authCb: (Env, cfg, tokens, url, cookies, cb) => {
            getClient(Env, cfg, (err, client) => {
                if (err) {
                    Env.Log.error('OPENID_AUTHCB_ERROR', err);
                    return void cb ('E_OIDC_CONNECT');
                }
                Env.Log.verbose('OPENID_AUTHCB');

                const token = tokens.code;
                const nonce = tokens.nonce;
                const config = {};
                let use_pkce = !(cfg.use_pkce === false);
                let use_nonce = !(cfg.use_nonce === false);
                if (use_pkce && token) {
                    config.code_verifier = token;
                }
                if (use_nonce && nonce) {
                    config.nonce = nonce;
                }

                const params = client.callbackParams(url);
                delete params.state;

                let username_claim = cfg.username_claim || 'name';
                //let email_claim = cfg.email_claim || 'email'; // This is not yet used

                client.callback(opts.callbackURL, params, config)
                        .then((tokenSet) => {
                    let j = tokenSet;
                    let c = tokenSet.claims();
                    let name = c[username_claim];
                    const end = () => {
                        cb(void 0, {
                            id: c.sub,
                            name: name,
                            idpData: {
                                expires_at: j.expires_at,
                                access_token: j.access_token,
                                refresh_token: j.refresh_token,
                                //id_token: j.id_token // XXX no need to store id_token?
                            }
                        });
                    };
                    if (name) { return void end(); }
                    client.userinfo(j.access_token).then((data) => {
                        name = data[username_claim];
                        end();
                        Env.Log.debug('OPENID_USERINFO', data);
                    }, (err) => {
                        Env.Log.error('ERROR_OPENID_USERINFO', err);
                        name = 'Unknown'; // XXX
                        end();
                    });
                });
            });
        },
    };
};
