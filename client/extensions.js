define([
    '/api/config',
    '/common/common-util.js',
    '/customize/messages.js'
], function (ApiConfig, Util, Messages) {
    return function (MyMessages) {
        const extensions = {};

        extensions.ADMIN_CATEGORY = [{
            id: 'sso',
            name: MyMessages.admin_category,
            icon: 'fa fa-server',
            content: ['sso-enable','sso-config','sso-list']
        }];
        const getData = (sframeChan, cb) => {
            sframeChan.query('Q_ADMIN_RPC', {
                cmd: 'LIST_SSO',
            }, function (e, response) {
                if (e || response?.error) {
                    UI.warn(Messages.error);
                    cb(e || response.error);
                    return console.error(e, response);
                }
                cb(void 0, response);
            });
        };

        const onStateEvt = Util.mkEvent();
        extensions.ADMIN_ITEM = [{
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
                            let state = getState();
                            if (state === checked) {
                                onStateEvt.fire(state);
                            }
                            $input.prop('checked', state);
                        });
                    });
                });
                cb(blocks.form([enableSSO], []));
            }
        }, {
            id: 'sso-config',
            title: MyMessages.config_global,
            getContent: (common, blocks, utils, cb) => {
                const { $, APP, UI } = utils;
                const sframeChan = common.getSframeChannel();

                const getEnforced = () => {
                    const key = 'sso-config-enforced';
                    const hint = MyMessages.config_enforced;

                    const labelAll = MyMessages.config_enforced_all;
                    const labelSSO = MyMessages.config_enforced_sso;

                    const getState = () => String(Boolean(APP.instanceConfig?.sso?.force));
                    const cmd = 'ENFORCE_SSO';
                    const radio = blocks.radio(key, getState(), {
                        values: { 'false': labelAll, 'true': labelSSO },
                        spinner: true
                    }, checked => {
                        radio.spinner.spin();
                        let $input = $(radio).find('input');
                        $input.prop('disabled', 'disabled');
                        sframeChan.query('Q_ADMIN_RPC', {
                            cmd: 'ADD_SSO_DECREE',
                            data: [cmd, [checked === 'true']]
                        }, function (e, response) {
                            if (e || response.error) {
                                UI.warn(Messages.error);
                                console.error(e, response);
                                radio.spinner.hide();
                            } else {
                                radio.spinner.done();
                            }
                            $input.prop('disabled', false);
                            APP.updateStatus(function () {
                                let state = getState();
                                console.error(state, $input, $input.filter(`[value="${state}"]`));
                                $input.filter(`[value="${state}"]`).prop('checked', true);
                            });
                        });
                    });

                    return blocks.hintItem(hint, radio);
                };

                const getPw = () => {
                    const key = 'sso-config-password';
                    const hint = MyMessages.config_password;
                    const labelYes = MyMessages.config_password_yes;
                    const labelNo = MyMessages.config_password_no;
                    const labelForce = MyMessages.config_password_force;

                    const getState = () => String(APP.instanceConfig?.sso?.password || 0);
                    const cmd = 'PASSWORD_SSO';

                    const radio = blocks.radio(key, getState(), {
                        values: { '0':labelNo, '1':labelYes, '2':labelForce },
                        spinner: true
                    }, checked => {
                        radio.spinner.spin();
                        let $input = $(radio).find('input');
                        $input.prop('disabled', 'disabled');
                        sframeChan.query('Q_ADMIN_RPC', {
                            cmd: 'ADD_SSO_DECREE',
                            data: [cmd, [Number(checked)]]
                        }, function (e, response) {
                            if (e || response.error) {
                                UI.warn(Messages.error);
                                console.error(e, response);
                                radio.spinner.hide();
                            } else {
                                radio.spinner.done();
                            }
                            $input.prop('disabled', false);
                            APP.updateStatus(function () {
                                let state = getState();
                                $input.find(`[value="${state}"]`).prop('checked', state);
                            });
                        });
                    });
                    return blocks.hintItem(hint, radio);
                };

                const enforced = getEnforced();
                const pw = getPw();

                let setEditable = state => {
                    let $all = $([enforced, pw]).find('input');
                    $all.prop('disabled', state ? false : 'disabled');
                };

                onStateEvt.reg(setEditable);
                setEditable(!!APP.instanceConfig?.sso);

                cb([enforced, pw]);
            }
        }, {
            id: 'sso-list',
            title: MyMessages.list_providers,
            getContent: (common, blocks, utils, cb) => {
                const { $, APP, UI } = utils;
                const sframeChan = common.getSframeChannel();

                const addForm = (isEdit) => {
                    let editValues;
                    const form = blocks.form();
                    const onChangeEvt = Util.mkEvent();
                    const uid = Util.uid();
                    // ID
                    const idInput = blocks.input();
                    const idLabel = blocks.labelledInput(MyMessages.provider_id, idInput);

                    // Type
                    const tKey = `type-${uid}`;
                    const typeInput = blocks.radio(tKey, null, {
                        values: {
                            'oidc': MyMessages.oidc,
                            'saml': MyMessages.saml
                        }
                    }, type => {
                        onChangeEvt.fire(type);
                    });
                    const typeLabel = blocks.labelledInput(MyMessages.provider_type, typeInput);

                    onChangeEvt.reg(type => {
                        $(form).empty();
                        // URL
                        const urlInput = blocks.input();
                        const urlLabel = blocks.labelledInput(MyMessages.provider_url, urlInput);

                        if (type === 'saml') {

                            if (isEdit) {
                                urlInput.value = isEdit.url;
                            }
                            $(form).append([urlLabel]);
                            return;
                        }



                        if (isEdit) {
                            urlInput.value = isEdit.url;
                        }
                        $(form).append([urlLabel]);
                    });

                    if (isEdit) {
                        onChangeEvt.fire(isEdit.type);
                        idInput.setAttribute('readonly', 'readonly');
                        idInput.value = isEdit.name;
                        $(typeInput).find(`[value="${isEdit.type}"]`).prop('checked', true);
                    }

                    // XXX button "ADD" or "EDIT" and "REMOVE"
                    return blocks.form([idLabel, typeLabel, form]);
                };

                const list = blocks.form();
                list.classList.add('plugin-sso-provider-list');
                getData(sframeChan, (err, obj) => {
                    if (err || !obj[0]) { return; }
                    obj[0].list.forEach(data => {
                        list.appendChild(addForm(data));
                    });
                });
                let f = addForm();

                cb(blocks.form([f, list]));
            }
        }];



        return extensions;
    };
});

