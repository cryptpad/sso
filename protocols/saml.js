const { SAML } = require('@node-saml/node-saml');

const TYPE = 'saml';

module.exports = (SSOUtils) => {
    const getClient = (Env, cfg, cb) => {
        const opts = SSOUtils.getOptions(Env);
        const saml = new SAML({
            callbackUrl: opts.callbackURL,
            entryPoint: cfg.url,
            issuer: cfg.issuer,
            idpCert: cfg.cert,
            privateKey: cfg.privateKey,
            publicCert: cfg.signingCert
        });
        cb(void 0, saml);
    };
    const getMetadata = (Env, cfg, cb) => {
        getClient(Env, cfg, (err, client) => {
            if (err) { return void cb(err); }
            cb(null, client.generateServiceProviderMetadata(null, cfg.signingCert));
        });
    };

    return {
        type: TYPE,
        getMetadata: getMetadata,
        checkConfig: (cfg) => {
            return cfg.url && cfg.issuer && cfg.cert;
        },
        auth: (Env, cfg, cb) => {
            getClient(Env, cfg, (err, client) => {
                if (err) { return void cb ('E_OIDC_CONNECT'); }
                client.getAuthorizeUrlAsync().then((url) => {
                    cb(void 0, { url: url });
                });
            });
        },
        authCb: (Env, cfg, token, url, cookies, cb) => {
            const samltoken = cookies.samltoken;
            if (!samltoken) { return void cb('NO_COOKIE'); }

            const Util = Env.modules.Util;
            SSOUtils.readRequest(Env, samltoken, (err, value) => {
                SSOUtils.deleteRequest(Env, samltoken);
                if (err || !value) { return void cb('EINVAL'); }
                const data = Util.tryParse(value);

                const nameRef = cfg.username_attr || 'displayName' || 'urn:oid:2.16.840.1.113730.3.1.241';

                getClient(Env, cfg, (err, client) => {
                    if (err) { return void cb ('E_SAML_CONNECT'); }
                    client.validatePostResponseAsync({
                        SAMLResponse: data.content
                    }).then((data) => {
                        if (!data || data.loggedOut || !data.profile || !data.profile.nameID) {
                            return void cb('EINVAL');
                        }
                        cb(void 0, {
                            id: data.profile.nameID,
                            name: data.profile[nameRef] || data.profile.nameID,
                            idpData: {}
                        });
                    }).catch(err => {
                        Env.Log.error('ERROR_SAML_CALLBACK', err);
                        return void cb('EINVAL');
                    });
                });
            });
        },
    };
};
