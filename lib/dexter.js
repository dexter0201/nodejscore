'use strict';

var iocContainer = require('nodejs-ioc-container');
var swig = require('swig');
var _container = iocContainer.container();
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var _events = new EventEmitter();
var _modules = [];
var _allMenus = [];
var _middleware = {
    before: {},
    after: {}
};
var _aggregated = {
    js: '',
    css:''
};
var _appMenus;

function NodeCore() {
    if (this.active) {
        return;
    }

    this.events = _events;
    this.version = require('../package').version;
}

NodeCore.prototype.app = function (name, options) {
    if (this.active) {
        return this;
    }

    findModules();
    enableModules();
    aggregate('js', null);

    this.name = name;
    this.active = true;
    this.options = options;
    _appMenus = new this.Menus();
    this.menus = _appMenus;

    return this;
};

NodeCore.prototype.status = function () {
    return {
        active: this.active,
        name: this.name
    };
};

NodeCore.prototype.register = _container.register;
NodeCore.prototype.resolve = _container.resolve;
NodeCore.prototype.load = _container.get;

NodeCore.prototype.modules = (function () {
    return _modules;
})();

NodeCore.prototype.aggregated = _aggregated;

NodeCore.prototype.Menus = function (name) {
    var _option = {
        roles: [
            'annonymous'
        ],
        title: '',
        menu: 'main',
        link: ''
    };

    this.add = function (options) {
        var _menu;

        options = _.extend(_option, options);
        _menu = {
            roles: options.roles,
            title: options.title,
            link: options.link
        };

        if (_allMenus[options.menu]) {
            _allMenus[options.menu].push(_menu);
        } else {
            _allMenus[options.menu] = [_menu];
        }
    };

    this.get = function (options) {
        var _allowed = [];

        options = _.extend(_option, options);

        if (_allMenus[options.menu] || options.defaultMenu) {
            var items = options.defaultMenu.concat(_allMenus[options.menu]);

            items.forEach(function (menu) {
                if (menu !== undefined) {
                    var _hasRole = false;

                    options.roles.forEach(function (role) {
                        if (role === 'admin' || menu.roles.indexOf('annonymous') > -1 || menu.roles.indexOf(role) > -1) {
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
};

NodeCore.prototype.Module = function (name) {
    this.name = name.toLowerCase();
    this.menus = _appMenus;

    // Bootstrap models
    walk(getModulePath(this.name) + '/server/models', null, function (path) {
        require(path);
    });

    this.render = function (view, options, callback) {
        swig.renderFile(getModulePath(this.name) + '/server/views/' + view + '.html', options, callback);
    };

    // Bootstrap routers
    this.routes = function () {
        var args = Array.prototype.slice.call(arguments);

        walk(getModulePath(this.name) + '/server/routes', null, function (path) {
            require(path).appy(this, [this].concat(args));
        });
    };

    this.aggregateAsset = function (type, path, options) {
        aggregate(
            type,
            _modules[this.name].source + '/public/assets/' + type + '/' + path,
            options
        );
    };

    this.angularDependencies = function (dependencies) {
        this.anguarDependencies = dependencies;
        _modules[this.name].dependencies = angularDependencies;
    };

    this.register = function (callback) {
        _container.register(name, callback);
    };

    this.settings = function () {
        if (!arguments.length) {
            return;
        }

        var database = dexter.get('database');

        if (!database || databse.connection) {
            return {
                err: true,
                message: 'No database connection'
            };
        }

        var Package = database.connection.model('Package');

        if (arguments.length === 2) {
            return updateSettings(this.name, arguments[0], arguments[1]);
        }

        if (arguments.length === 1 && typeof arguments[0] === 'object') {
            return updateSettings(this.name, arguments[0], function () {});
        }

        if (arguments.length === 1 && typeof arguments[0] === 'function') {
            return getSettings(this.name, arguments[0]);
        }

        function updateSettings(name, settings, callback) {
            Package.findOneAndUpdate({
                name: name
            }, {
                $set: {
                    settings: settings,
                    updated: new Date()
                }
            }, {
                upsert: true,
                multi: false
            }, function (err, doc) {
                if (err) {
                    console.log(err);
                    return callback(true, 'Failed to update settings');
                }

                return callback(null, doc);
            });
        }

        function getSettings(name, callback) {
            Package.findOne({
                name: name
            }, function (err, doc) {
                if (err) {
                    return callback(true, 'Failed to retrieve settings');
                }

                return callback(null, doc);
            });
        }
    };
};

NodeCore.prototype.chainware = {
    add: function (event, weight, func) {
        _middleware[event].splice(weight, 0, {
            weight: weight,
            func: func
        });
        _middleware[event].join();
        _middleware[event].sort(function (a, b) {
            if (a.weight < b.weight) {
                a.next = b.func;
            } else {
                b.next = a.func;
            }

            return (a.weight - b.weight);
        });
    },

    before: function (req, res, next) {
        if (!_middleware.before.length) {
            return next();
        }

        this.chain('before', 0, req, res, next);
    },

    after: function (req, res, next) {
        if (!_middleware.after.length) {
            return next();
        }

        this.chain('after', 0, req, res, next);
    },

    chain: function (operator, index, req, res, next) {
        var args = [
            req,
            res,
            function () {
                if (_middleware[operator][index + 1]) {
                    this.chain('before', index + 1, req, res, next);
                } else {
                    next();
                }
            }
        ];

        _middleware[operator][index].func.apply(this, args);
    }
};

function getModulePath(name) {
    return process.cwd() + '/' + _modules[name].source + '/' + name;
}

function findModules() {
    var searchSource = function (source, callback) {
        fs.stat(process.cwd() + '/' + source, function (err, stats) {
            if (err) {
                console.log(err);
                return;
            }

            if (stats.isDirectory()) {
                fs.readdir(process.cwd() + '/' + source, function (err, files) {
                    if (err) {
                        console.log(err);
                        return callback();
                    }

                    if (!files) {
                        files = [];
                    }

                    if (!files.length) {
                        return callback();
                    }

                    files.forEach(function (file, index) {
                        if (file === '.bin') {
                            return;
                        }

                        fs.readFile(process.cwd() + '/' + source + '/' + file + '/package.json', function (err, data) {
                            if (err) {
                                throw err;
                            }

                            if (data) {
                                var json = JSON.parse(data.toString());

                                if (json.dexter) {
                                    console.log('WOWWWW...Found Dexter...Pushing : ', json.name);
                                    _modules[json.name] = {
                                        version: json.version,
                                        source: source
                                    };
                                }
                            }

                            if (files.length - 1 === index) {
                                return callback();
                            }
                        });
                    });
                });
            }
        });
    };
    var source = 2;
    var searchDone = function () {
        source--;

        if (!source) {
            console.log('Event Emitted: modulesFound..');
            _events.emit('modulesFound');
        }
    };

    searchSource('node_modules', searchDone);
    searchSource('package', searchDone);
}

function enableModules() {
    _events.on('modulesFound', function () {
        for (var name in _modules) {
            require(process.cwd() + '/' + _modules[name].source + '/' + name + '/app.js');
        }

        for (var name in _modules) {
            name = capitaliseFirstLetter(name);
            _container.resolve().apply(this, [name]);
            _container.get(name);
        }
    });
}

function aggregate(ext, path, options) {
    var libs = true,
        name;

    options = options || {};

    if (path) {
        return readFiles(ext, process.cwd() + '/' +  path);
    }

    libs = false;
    _events.on('modulesFound', function () {
        for (name in _modules) {
            readFiles(ext, process.cwd() + '/' + _modules[name].source + '/' + name + '/public/');
        }
    });

    function readFiles(ext, path) {
        fs.stat(path, function (err, stats) {
            if (stats.isDirectory()) {
                fs.readdir(path, function (err, files) {
                    if (err) {
                        throw err;
                    }

                    if (!files) {
                        files = [];
                    }

                    files.forEach(function (file) {
                        if (!libs && file !== 'assets') {
                            readFile(ext, path + file);
                        }
                    });
                });
            }
        });
    }

    function readFile(ext, path) {
        fs.readdir(path, function (err, files) {
            if (files) {
                return readFiles(ext, path + '/');
            }

            if (path.indexOf('.' + ext) === -1) {
                return;
            }

            fs.readFile(path, function (err, data) {
                if (!data) {
                    readFiles(ext, path + '/');
                } else {
                    _aggregated[ext] += (ext === 'js' && !options.global) ? ('(function () { ' + data.toString() + ' }());') : data.toString() + '\n';
                }
            });
        });
    }
}

function walk(path, excludeDir, callback) {
    fs.readdirSync(path).forEach(function (file) {
        var newPath = path + '/' + file;
        var stat = fs.statSync(newPath);

        if (stat.isFile() && /(.*)\.(js|coffee)$/.test(file)) {
            callback(newPath);
        } else if (stat.isDirectory() && file !== excludeDir) {
            module.exports.walk(newPath, excludeDir, callback);
        }
    });
}

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = new NodeCore();