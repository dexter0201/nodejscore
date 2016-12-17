'use strict';

var _ = require('lodash');

function NamespaceMenu(NodeJsCore) {
    var _option = {
        roles: [
            'annonymous'
        ],
        title: '',
        menu: 'main',
        link: '',
        icon: ''
    };

    function Menus() {

    }

    Menus.prototype.add = function (options) {
        var _menu;

        options = _.extend(_option, options);
        _menu = {
            roles: options.roles,
            title: options.title,
            link: options.link,
            icon: options.icon
        };

        if (NodeJsCore.Singleton.menus[options.menu]) {
            NodeJsCore.Singleton.menus[options.menu].push(_menu);
        } else {
            NodeJsCore.Singleton.menus[options.menu] = [_menu];
        }

        return NodeJsCore.Singleton.menus;
    };

    Menus.prototype.get = function (options) {
        var _allowed = [];

        options = _.extend(_option, options);

        if (NodeJsCore.Singleton.menus[options.menu] || options.defaultMenu) {
            var items = options.defaultMenu.concat(NodeJsCore.Singleton.menus[options.menu]);

            items.forEach(function (menu) {
                if (menu !== undefined) {
                    var _hasRole = false;

                    options.roles.forEach(function (role) {
                        if (role === 'admin'||
                            (menu.roles && (menu.roles.indexOf('annonymous') > -1 || menu.roles.indexOf(role) > -1))) {
                            _hasRole = true;
                        }
                    });

                    if (_hasRole) {
                        _allowed.push(menu);
                    }
                }
            });
        }

        return _allowed;
    };

    NodeJsCore.prototype.Menus = Menus;
}

module.exports = NamespaceMenu;
