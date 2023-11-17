const SSO = {};
SSO.challenge = require('./challenge');
SSO.utils = require('./sso-utils');
SSO.types = SSO.utils.TYPES;
module.exports = {
  name: "SSO",
  modules: SSO
};
