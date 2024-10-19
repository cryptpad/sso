const OID = require('openid-client');

const TYPE = 'oidc';

module.exports = (SSOUtils) => {
    const opts = SSOUtils.getOptions();
    const getClient = (cfg, cb) => {
        OID.Issuer.discover(cfg.url).then((issuer) => { // XXX Only once for all users?
            let alg = cfg.jwt_alg || 'PS256';
            if (Array.isArray(issuer.id_token_signing_alg_values_supported) &&
                !issuer.id_token_signing_alg_values_supported.includes(alg)) {
                alg = issuer.id_token_signing_alg_values_supported[0] || 'RS256';
            }
            const client = new issuer.Client({
                client_id: cfg.client_id,
                client_secret: cfg.client_secret,
                redirect_uris: [opts.callbackURL],
                response_types: ['code'],
                id_token_signed_response_alg: alg
            });
            cb(void 0, client);
        }, (err) => {
            cb(err);
        });
    };
    return {
        type: TYPE,
        checkConfig: (cfg) => {
            return cfg.url && cfg.client_id && cfg.client_secret;
        },
        auth: (Env, cfg, cb) => {
            getClient(cfg, (err, client) => {
                if (err) { return void cb (err); }
                let username_scope = cfg.username_scope || 'profile';
                let email_scope = cfg.email_scope || 'email'; // This is not yet used

                const generators = OID.generators;
                const code_verifier = generators.codeVerifier();
                const code_challenge = generators.codeChallenge(code_verifier);
                const url = client.authorizationUrl({
                    scope: `openid ${username_scope} ${email_scope}`,
                    resource: opts.callbackURL,
                    access_type: 'offline',
                    code_challenge,
                    code_challenge_method: 'S256',
                    state: Math.random().toString(36), // Just create a state for providers that require it...
                });

                cb(void 0, { url: url, token: code_verifier });
            });
        },
        authCb: (Env, cfg, token, url, cookies, cb) => {
            getClient(cfg, (err, client) => {
                if (err) { return void cb (err); }

                const params = client.callbackParams(url);
                delete params.state;

                let username_claim = cfg.username_claim || 'name';
                let email_claim = cfg.email_claim || 'email'; // This is not yet used

                client.callback(opts.callbackURL, params, { code_verifier: token })
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
                    let t = client.userinfo(j.access_token).then((data) => {
                        name = data.name;
                        end();
                        console.log(t);
                    }, (err) => {
                        console.error(err);
                        name = 'Unknown'; // XXX
                        end();
                    });
                });
            });
        },
    };
};
