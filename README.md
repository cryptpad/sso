# CryptPad SSO Plugin

The CryptPad SSO plugin can be manually installed to allow a CryptPad instance to be connected to an SSO system.

This allows to restrict registration to only SSO users or to display a "Register with SSONAME" button on the connection and registration screen.

Users will still be able to create a personal password which will be used to make the "encryption key" of their drive secret from the SSO Administrators.

## Manual installation

Go the cryptpad/lib/plugins directory on your server

```
cd cryptpad/lib/plugins
git clone https://github.com/cryptpad/sso/
```

Go to the cryptpad/config directory on your server

```
cd cryptpad/config
cp sso.example.js sso.js
```

and edit the sso.js to set the credentials to your SSO server:

## Create an OpenID Connect COnfiguration on your authentication server

The SSO module has been succesfully tested using KeyCloak and Univention UCS using default settings.
When setting up the client credentials on your OpenIDC Connect server the following redirect URI needs to be set

https://<yourdomain>/ssoauth

(In case you are still using a local test http server the URL should be http://<yourdomain>:<yourport>/ssoauth)

### sso.js sample configurations

Here are example configuration files for sso.js with examples for KeyCloak, Univention UCS and SAML

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
        jwt_alg: 'RS256'
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
        signingCert: fs.readFileSync("./your/signing/cert/location", "utf-8"),
    }
    */
    ]
};
```
