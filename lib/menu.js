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
        if (options instanceof Array) {
            options.forEach(Menus.prototype.add.bind(this));
                return this;
        }

        var item;

        options = _.assign({
            path: 'main',
            roles: ['annonymous']
        }, options);

        options.path = options.path.replace(/^\//, '');
        item = allMenus.findOneOrCreate(options.path.split('/'));
        item.add(new MenuItem(options));

        return this;
        // var _menu;
        //
        // options = _.extend(_option, options);
        // _menu = {
        //     roles: options.roles,
        //     title: options.title,
        //     link: options.link,
        //     icon: options.icon
        // };
        //
        // if (NodeJsCore.Singleton.menus[options.menu]) {
        //     NodeJsCore.Singleton.menus[options.menu].push(_menu);
        // } else {
        //     NodeJsCore.Singleton.menus[options.menu] = [_menu];
        // }
        //
        // return NodeJsCore.Singleton.menus;
    };

    Menus.prototype.get = function (options) {
        options = options || {};
        options.menu = options.menu || 'main';
        options.roles = options.roles || ['annonymous'];

        var subMenus = allMenus.get(options.roles, options.menu.split('/')),
            ret = subMenus.get(options.roles);

        return ret ? ret.submenus : [];
        // var _allowed = [];
        //
        // options = _.extend(_option, options);
        //
        // if (NodeJsCore.Singleton.menus[options.menu] || options.defaultMenu) {
        //     var items = options.defaultMenu.concat(NodeJsCore.Singleton.menus[options.menu]);
        //
        //     items.forEach(function (menu) {
        //         if (menu !== undefined) {
        //             var _hasRole = false;
        //
        //             options.roles.forEach(function (role) {
        //                 if (role === 'admin'||
        //                     (menu.roles && (menu.roles.indexOf('annonymous') > -1 || menu.roles.indexOf(role) > -1))) {
        //                     _hasRole = true;
        //                 }
        //             });
        //
        //             if (_hasRole) {
        //                 _allowed.push(menu);
        //             }
        //         }
        //     });
        // }
        //
        // return _allowed;
    };

    NodeJsCore.prototype.Menus = Menus;
}

function extractNames(v) {
    return v.name;
}

function get_get(roles, v) {
    return v.get(roles);
}

function remove_nulls(v) {
    return v;
}

function MenuItem(options) {
    options = _.assign({
        name: null,
        title: null,
        link: null,
        roles: null
    }, options);

    options.name = options.name || options.link;
    this.name = options.name;
    this.title = options.tile;
    this.link = options.link;
    this.roles = options.roles;
    this.submenus = [];
}

MenuItem.hasRole = function (role, roles) {
    return roles.indexOf(role) > -1;
};

MenuItem.prototype.props = function () {
    return {
        name: this.name,
        title: this.title,
        link: this.link,
        roles: this.roles
    };
};

MenuItem.prototype.findOneOrCreate = function (path) {
    if (!path.length) {
        return this;
    }

    var p = path.shift(),
        index = this.list().indexOf(p);

    if (index > -1) {
        return this.submenus[index].findOneOrCreate(path);
    }

    var n = new MenuItem();

    n.name = p;
    this.submenus.push(n);

    return n.findOneOrCreate(path);
};

MenuItem.prototype.get = function (roles, path) {
    roles = roles ? roles.slice() : [];

    if (roles.indexOf('annonymous') < 0) {
        roles.push('authenticated');
    }

    var list = this.list();

    if (path) {
        if (!path.length) {
            return this;
        }

        var n = path.shift(),
            index = list.indexOf(n);

        return this.submenus[index] ? this.submenus[index].get(roles, path) : undefined;
    }

    if (this.roles && !MenuItem.hasRole('admin', roles)) {
        if (!_.intersection(this.roles, roles).length) {
            return undefined;
        }
    }

    var ret = {
        roles: this.roles || null,
        link: this.link || null,
        title:this.title || null,
        name: this.name || null,
        submenus: this.submenus.map(get_get.bind(null, roles)).filter(remove_nulls),
    };

    return ret;
};

MenuItem.prototype.list = function () {
    return this.submenus.map(extractNames);
};

MenuItem.prototype.add = function (mi) {
    var index = this.list().indexOf(mi.name);
    var itm;

    if (index > -1) {
        var ts = mi.props();

        itm = this.submenus[index];

        for (var i in ts) {
            itm[i] = ts[i];
        }
    } else {
        itm = mi;
        this.submenus.push (itm);
    }

    return itm;
};

var allMenus = new MenuItem();

function mapSubmenuNames(v) {
    return v.name;
}

module.exports = NamespaceMenu;
