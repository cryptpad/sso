define([
    '/api/config',
    '/customize/messages.js'
], function (ApiConfig, Messages) {
    return function (MyMessages) {
        const extensions = {};

        extensions.ADMIN_CATEGORY = [{
            id: 'sso',
            name: MyMessages.admin_category,
            icon: 'fa fa-server',
            content: ['sso-enable']
        }];
        extensions.ADMIN_ITEM = [
            {
                id: 'sso-enable',
                title: MyMessages.enable_global,
                getContent: (common, blocks, utils, cb) => {
                    const { $, APP, UI } = utils;
                    const sframeChan = common.getSframeChannel();
                    const key = 'sso-enable-check';
                    const label = MyMessages.admin_ssoEnable;
                    const getState = () => {
                        return Boolean(APP.instanceConfig.sso);
                    };
                    const enableSSO = blocks.checkbox(key, label, getState(), {
                        spinner: true
                    }, checked => {
                        enableSSO.spinner.spin();
                        let $input = $(enableSSO).find('input');
                        $input.prop('disabled', 'disabled');
                        sframeChan.query('Q_ADMIN_RPC', {
                            cmd: 'ADD_SSO_DECREE',
                            data: ['ENABLE_SSO', [checked]]
                        }, function (e, response) {
                            if (e || response.error) {
                                UI.warn(Messages.error);
                                console.error(e, response);
                                enableSSO.spinner.hide();
                            } else {
                                enableSSO.spinner.done();
                            }
                            $input.prop('disabled', false);
                            APP.updateStatus(function () {
                                let state = Boolean(APP.instanceConfig.sso);
                                $input.prop('checked', state);
                                //flushCache(); // XXX
                            });
                        });
                    });
                    cb(blocks.form([enableSSO], []));

                }
            }
        ];



        return extensions;
    };
});

