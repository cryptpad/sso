define([
    '/api/config',
    '/common/common-util.js',
    '/common/common-interface.js',
    '/common/common-icons.js',
    '/customize/messages.js'
], function (ApiConfig, Util, UI, Icons, Messages) {
    return function (MyMessages) {
        const extensions = {};

        Icons.add({
            "sso": "id-card"
        });

        extensions.ADMIN_CATEGORY = [{
            id: 'sso',
            name: MyMessages.admin_category,
            icon: 'sso',
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
                if (!Array.isArray(response)) { return void cb('EINVAL'); }
                cb(void 0, response[0]);
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
                const { $, UI } = utils;
                const sframeChan = common.getSframeChannel();

                let redraw = () => {};

                const addForm = (isEdit) => {
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

                    let getValues = () => {};

                    // SAML
                    onChangeEvt.reg(type => {
                        if (type !== 'saml') { return; }
                        $(form).empty();

                        // URL
                        const urlInput = blocks.input();
                        const urlLabel = blocks.labelledInput(MyMessages.provider_url, urlInput);

                        // Issuer
                        const issuerInput = blocks.input();
                        const issuerLabel = blocks.labelledInput(MyMessages.provider_saml_issuer, issuerInput);

                        // IdP cert
                        const idpcInput = blocks.textarea();
                        const idpcLabel = blocks.labelledInput(MyMessages.provider_saml_idpcert, idpcInput);

                        // Service Provider cert
                        const spcInput = blocks.textarea();
                        const spcLabel = blocks.labelledInput(MyMessages.provider_saml_providercert, spcInput);

                        // Private key
                        const pkInput = blocks.textarea();
                        const pkLabel = blocks.labelledInput(MyMessages.provider_saml_private, pkInput);

                        // User name
                        const nameInput = blocks.input();
                        const nameLabel = blocks.labelledInput(MyMessages.provider_saml_name, nameInput);

                        if (isEdit) {
                            urlInput.value = isEdit.url;
                            issuerInput.value = isEdit.issuer || '';
                            idpcInput.value = isEdit.cert || '';
                            spcInput.value = isEdit.signingCert || '';
                            pkInput.value = isEdit.privateKey || '';
                            nameInput.value = isEdit.username_attr || '';
                        }

                        getValues = () => {
                            return {
                                name: idInput.value,
                                type: 'saml',
                                url: urlInput.value,
                                issuer: issuerInput.value,
                                cert: idpcInput.value,
                                signingCert: spcInput.value,
                                privateKey: pkInput.value,
                                username_attr: nameInput.value
                            };
                        };

                        $(form).append([urlLabel, issuerLabel, idpcLabel, spcLabel, pkLabel, nameLabel]);
                    });
                    // OIDC
                    onChangeEvt.reg(type => {
                        if (type !== 'oidc') { return; }
                        $(form).empty();
                        // URL
                        const urlInput = blocks.input();
                        const urlLabel = blocks.labelledInput(MyMessages.provider_url, urlInput);

                        // Client ID
                        const cidInput = blocks.input();
                        const cidLabel = blocks.labelledInput(MyMessages.provider_oidc_id, cidInput);

                        // Client Secret
                        const secretInput = blocks.input();
                        const secretLabel = blocks.labelledInput(MyMessages.provider_oidc_secret, secretInput);

                        // ID Token alg
                        const idAlgInput = blocks.input({placeholder:'PS256'});
                        const idAlgLabel = blocks.labelledInput(MyMessages.provider_oidc_idalg, idAlgInput);

                        // User Info alg
                        const userAlgInput = blocks.input();
                        const userAlgLabel = blocks.labelledInput(MyMessages.provider_oidc_useralg, userAlgInput);

                        // PKCE
                        const pkce = blocks.checkbox(`sso-pkce-${uid}`, MyMessages.provider_oidc_pkce, true);

                        // Nonce
                        const nonce = blocks.checkbox(`sso-nonce-${uid}`, MyMessages.provider_oidc_nonce, true);

                        // User name
                        const userScopeInput = blocks.input({placeholder:'profile'});
                        const userScopeLabel = blocks.labelledInput(MyMessages.provider_oidc_userscope, userScopeInput);
                        const userClaimInput = blocks.input({placeholder:'name'});
                        const userClaimLabel = blocks.labelledInput(MyMessages.provider_oidc_userclaim, userClaimInput);

                        if (isEdit) {
                            urlInput.value = isEdit.url || '';
                            cidInput.value = isEdit.client_id || '';
                            secretInput.value = isEdit.client_secret || '';
                            idAlgInput.value = isEdit.id_token_alg || isEdit.jwt_alg || '';
                            userAlgInput.value = isEdit.userinfo_token_alg || isEdit.jwt_alg || '';
                            $(pkce).find('input').prop('checked', isEdit.use_pkce !== false);
                            $(nonce).find('input').prop('checked', isEdit.use_nonce !== false);
                            userScopeInput.value = isEdit.username_scope || '';
                            userClaimInput.value = isEdit.username_claim || '';
                        }

                        getValues = () => {
                            return {
                                name: idInput.value,
                                type: 'oidc',
                                url: urlInput.value,
                                client_id: cidInput.value,
                                client_secret: secretInput.value,
                                id_token_alg: idAlgInput.value || isEdit.jwt_alg || undefined,
                                userinfo_token_alg: userAlgInput.value || isEdit.jwt_alg || undefined,
                                use_nonce: $(nonce).find('input').is(':checked'),
                                use_pkce: $(pkce).find('input').is(':checked'),
                                username_scope: userScopeInput.value,
                                username_claim: userClaimInput.value,
                            };
                        };
                        $(form).append([urlLabel, cidLabel, secretLabel, idAlgLabel, userAlgLabel, pkce, nonce, userScopeLabel, userClaimLabel]);
                    });

                    if (isEdit) {
                        onChangeEvt.fire(isEdit.type);
                        idInput.setAttribute('readonly', 'readonly');
                        idInput.value = isEdit.name;
                        $(typeInput).find(`[value="${isEdit.type}"]`).prop('checked', true);
                    }

                    const edit = blocks.button('primary', 'edit', Messages.tag_edit);
                    const remove = blocks.button('danger', 'trash-full', Messages.fc_remove);
                    const $edit = $(edit), $remove = $(remove);
                    Util.onClickEnter($edit, () => {
                        $edit.prop('disabled', 'disabled');
                        let v = getValues();
                        sframeChan.query('Q_ADMIN_RPC', {
                            cmd: 'ADD_SSO_DECREE',
                            data: ['UPDATE_PROVIDER', {
                                id: v.name,
                                value: v
                            }]
                        }, function (e, response) {
                            $edit.prop('disabled', false);
                            if (e || response.error) {
                                UI.warn(Messages.error);
                                console.error(e, response);
                            } else {
                                UI.log(Messages.ui_success);
                            }
                            redraw();
                        });
                    });

                    Util.onClickEnter($remove, () => {
                        $remove.prop('disabled', 'disabled');
                        UI.confirm(MyMessages.provider_remove_confirm, yes => {
                            if (!yes) {
                                return void $remove.prop('disabled', false);
                            }
                            sframeChan.query('Q_ADMIN_RPC', {
                                cmd: 'ADD_SSO_DECREE',
                                data: ['UPDATE_PROVIDER', {
                                    id: isEdit.name,
                                    value: false
                                }]
                            }, function (e, response) {
                                $remove.prop('disabled', false);;
                                if (e || response.error) {
                                    UI.warn(Messages.error);
                                    console.error(e, response);
                                } else {
                                    UI.log(Messages.ui_success);
                                }
                                redraw();
                            });
                        });
                    });

                    const nav = blocks.nav([edit, remove]);

                    return blocks.form([idLabel, typeLabel, form], nav);
                };

                const list = blocks.form();
                list.classList.add('plugin-sso-provider-list');
                const listLabel = blocks.labelledInput(MyMessages.provider_list, list);

                redraw = () => {
                    $(list).empty();
                    getData(sframeChan, (err, obj) => {
                        if (err || !obj || !Array.isArray(obj.list)) { return; }
                        if (!obj.list.length) {
                            $(listLabel).hide();
                        } else {
                            $(listLabel).show();
                        }
                        obj.list.forEach(data => {
                            list.appendChild(addForm(data));
                        });
                    });
                };
                redraw();


                // ID
                const newInput = blocks.input();
                const newButton = blocks.button('primary', 'add', Messages.tag_add);
                const newMerge = blocks.inputButton(newInput, newButton, {onEnterDelegate:true});
                const newLabel = blocks.labelledInput(MyMessages.provider_new, newMerge);

                const $inputId = $(newInput).on('input', () => {
                    const val = $inputId.val().replace(/[^a-zA-Z-_ ]/g, '');
                    $inputId.val(val);
                });

                const $newButton = $(newButton).click(function () {
                    const value = $(newInput).val().trim();
                    if (!value) { return; }
                    $newButton.prop('disabled', 'disabled');
                    sframeChan.query('Q_ADMIN_RPC', {
                        cmd: 'ADD_SSO_DECREE',
                        data: ['UPDATE_PROVIDER', {
                            id: value,
                            value: { name: value }
                        }]
                    }, function (e, response) {
                        $newButton.prop('disabled', false);;
                        if (e || response.error) {
                            UI.warn(Messages.error);
                            console.error(e, response);
                        } else {
                            UI.log(Messages.ui_success);
                        }
                        redraw();
                    });
                });

                cb(blocks.form([newLabel, listLabel]));
            }
        }];



        return extensions;
    };
});

