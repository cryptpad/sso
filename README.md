# CryptPad SSO Plugin

The CryptPad SSO plugin can be manually installed to allow a CryptPad instance to be connected to a single sign-on (SSO) system.

This allows to restrict registrations to only SSO users or to display a “Register with SSONAME” button on the connection and registration screen.

Users will still be able to create a personal password which will be used to derive the “encryption key” of their drive secret from SSO Administrators.

## Features supported

- OIDC and SAML SSO connectors;
- Allow logging in using one or more SSO systems;
- Allow restricting login to only SSO;
- Store public key information of SSO users on the CryptPad server.

## Features not supported / Future Work

- Store extra information from users coming from SSO;
- Allow sharing documents with SSO users without the need to connect with them;
- Allow administrators to manage SSO users (see their storage use, delete their data, etc.);
- Allow synchronizing OIDC roles/groups with CryptPad teams;
- Additional SSO protocols.

If you are interested in these extra features and wish to sponsor them, contact XWiki SAS at sales@cryptpad.org

## Manual installation

1. Go the cryptpad/lib/plugins directory on your server

```
cd cryptpad/lib/plugins
git clone https://github.com/cryptpad/sso/
```

2. Go to the cryptpad/config directory on your server

```
cd ../../config
cp sso.example.js sso.js
```

3. Edit the `sso.js` config file to set the credentials to your SSO server ([more instructions here](#ssojs-sample-configurations))

4. Flush the cache on your Cryptpad instance

On the web interface, login, and then go to:
Administration > General (default) > Flush HTTP Cache > click "FLUSH CACHE"

> At this point you may be done, but if issues persist try restarting your Cryptpad instance with `systemctl restart ...`, `service ... restart`, or `reboot`

## Create an OpenID Connect Configuration on your authentication server

The SSO module has been successfully tested using KeyCloak and Univention UCS using default settings.
When setting up the client credentials on your OpenIDC Connect server the following redirect URI needs to be set

`https://<yourdomain>/ssoauth`

(In case you are still using a local test http server the URL should be `http://<yourdomain>:<yourport>/ssoauth`)

### sso.js sample configurations

Here follows an example configuration file for `sso.js` showing examples for KeyCloak, Univention UCS and SAML:

```
// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

//const fs = require('node:fs');
module.exports = {
    // Enable SSO login on this instance
    enabled: true,
    // Block registration for non-SSO users on this instance
    enforced: false,
    // Allow users to add an additional CryptPad password to their SSO account
    cpPassword: true,
    // You can also force your SSO users to add a CryptPad password
    forceCpPassword: true,
    // List of SSO providers
    list: [
      {
        name: 'keycloak',
        type: 'oidc',
        url: 'https://<keycloakserver/realms/<realm>',
        client_id: "cryptpad",
        client_secret: "<clientsecret>",
        jwt_alg: 'RS256', (deprecated)
        id_token_alg: 'PS256', (optional)
        userinfo_token_alg: 'PS256', (optional)
        username_scope: 'profile',  (optional)
        username_claim: 'name', (optional)
        use_pkce: true, (optional)
        use_nonce: true (optional)
      },
    /*

    // Sample Univention UCS Configuration (using Kopano Connect)
    {
        name: 'xwiki', 
        type: 'oidc',
        url: 'https://ucs-sso.<yourdomain>',
        client_id: "cryptpad",
        client_secret: "<yoursecret",
        jwt_alg: 'PS256'
    },
    // Sample Google Configuration
    {
        name: 'google',
        type: 'oidc',
        url: 'https://accounts.google.com',
        client_id: "{your_client_id}",
        client_secret: "{your_client_secret}",
        jwt_alg: 'RS256' (optional)
    },
    // Sample SAML Configuration
    {
        name: 'samltest',  
        type: 'saml',
        url: 'https://samltest.id/idp/profile/SAML2/Redirect/SSO',
        issuer: 'your-cryptpad-issuer-id',
        cert: String or fs.readFileSync("./your/cert/location", "utf-8"),
        privateKey: fs.readFileSync("./your/private/key/location", "utf-8"),
        publicCert: fs.readFileSync("./your/signing/cert/location", "utf-8"),
    }
    */
    ]
};
```
