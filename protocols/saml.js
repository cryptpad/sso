const { SAML } = require('@node-saml/node-saml');
const Util = require("../../../common-util");

const TYPE = 'saml';

module.exports = (SSOUtils) => {
    const opts = SSOUtils.getOptions();
    const getClient = (cfg, cb) => {
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
    const getMetadata = (cfg, cb) => {
        getClient(cfg, (err, client) => {
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
            getClient(cfg, (err, client) => {
                if (err) { return void cb ('E_OIDC_CONNECT'); }
                client.getAuthorizeUrlAsync().then((url) => {
                    cb(void 0, { url: url });
                });
            });
        },
        authCb: (Env, cfg, token, url, cookies, cb) => {
            const samltoken = cookies.samltoken;
            if (!samltoken) { return void cb('NO_COOKIE'); }
            SSOUtils.readRequest(Env, samltoken, (err, value) => {
                SSOUtils.deleteRequest(Env, samltoken);
                if (err || !value) { return void cb('EINVAL'); }
                const data = Util.tryParse(value);

                // eslint-disable-next-line no-constant-binary-expression
                const nameRef = cfg.username_attr || 'displayName' || 'urn:oid:2.16.840.1.113730.3.1.241';

                getClient(cfg, (err, client) => {
                    if (err) { return void cb ('E_OIDC_CONNECT'); }
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
                    });
                });
            });
        },
    };
};
