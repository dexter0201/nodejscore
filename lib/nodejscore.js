'use strict';

var iocContainer = require('nodejs-ioc-container'),
    swig = require('swig'),
    mongoose = require('mongoose'),
    _container = iocContainer.container(),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    _ = require('lodash'),
    path = require('path'),
    util = require('./util'),
    q = require('q'),
    http = require('http'),
    https = require('https');

var _events = new EventEmitter(),
    _middleware = {
        before: {},
        after: {}
    };

function NodeJsCore() {
    if (this.active) {
        return;
    }

    NodeJsCore.Singleton = this;

    this.events = _events;
    this.version = require('../package').version;
}

NodeJsCore.events = _events;

NodeJsCore.prototype.serve = function (options, callback) {
    if (this.active) {
        return this;
    }

    var defaultConfig = util.loadConfig();

    var database = mongoose.connect(defaultConfig.db || '', function (err) {
        if (err) {
            console.error('Error: ', err.message);
            return console.error('**Could not connect to MongoDB. Please ensure mongod is running and restart NodeJsCore app.**');
        }

        NodeJsCore.Singleton.register('database', {
            connection: database
        });

        NodeJsCore.Singleton.config = new Config(function (err, config) {
            var app = require('./bootstrap')(options, database);
            var httpServer = http.createServer(app);

            NodeJsCore.Singleton.register('http', httpServer);
            httpServer.listen(config.http ? config.http.port : config.port, config.hostname);

            if (config.https && config.https.port) {
                var httpsOptions = {
                    key: fs.readFileSync(config.https.ssl.key),
                    cert: fs.readFileSync(config.https.ssl.cert)
                };
                var httpsServer = https.createServer(httpsOptions, app);

                NodeJsCore.Singleton.register('https', httpsServer);
                httpsServer.listen(config.https.port);
            }

            findModules(function () {
                enableModules(function () {

                });
            });
            NodeJsCore.Singleton.aggregate('js', null);

            NodeJsCore.Singleton.name = config.app.name;
            NodeJsCore.Singleton.app = app;

            NodeJsCore.Singleton.menus = new NodeJsCore.Singleton.Menus();

            if (!callback || typeof callback !== 'function') {
                callback = function () {};
            }

            callback(app, defaultConfig);
        });

        NodeJsCore.Singleton.active = true;
        NodeJsCore.Singleton.options = options;
    });
};

function Config(callback) {
    if (this.config) {
        return this.config;
    }

    if (!callback || typeof callback !== 'function') {
        callback = function () {};
    }

    loadSettings(this, callback);

    function loadSettings(Config, callback) {
        var Package = loadPackageModel(),
            defaultConfig = util.loadConfig();

        if (!Package) {
            return defaultConfig;
        }

        Package.findOne({
            name: 'config'
        }, function (err, doc) {
            var original = JSON.flatten(defaultConfig, {
                default: true
            });

            var saved = JSON.flatten(doc ? doc.settings : defaultConfig, {});
            var merged = mergeConfig(original, saved);
            var clean = JSON.unflatten(merged.clean, {});
            var diff = JSON.unflatten(merged.diff, {});

            Config.verbose = {
                clean: clean,
                diff: diff,
                flat: merged
            };

            Config.clean = clean;
            Config.diff = diff;
            Config.flat = merged;

            callback(err, clean);
        });

        function mergeConfig(original, saved) {
            var clean = {};

            for (var index in saved) {
                clean[index] = saved[index].value;

                if (original[index]) {
                    original[index].value = saved[index].value;
                } else {
                    original[index] = {
                        value: saved[index].value,
                    };
                }

                original[index]['default'] = original[index]['default'] || saved[index]['default'];
            }

            return {
                diff: original,
                clean: clean
            };
        }
    }

    function loadPackageModel() {
        var database = _container.get('database');

        if (!database || !database.connection) {
            return null;
        }

        if (!database.connection.models.Package) {
            require('../modules/package')(database);
        }

        return database.connection.model('Package');
    }


}

NodeJsCore.prototype.loadConfig = util.loadConfig;

NodeJsCore.prototype.status = function () {
    return {
        active: this.active,
        name: this.name
    };
};

NodeJsCore.prototype.register = _container.register;
NodeJsCore.prototype.resolve = _container.resolve;
NodeJsCore.prototype.load = _container.get;

NodeJsCore.prototype.moduleEnabled = function (name) {
    return this.modules[name] ? true : false;
};

// static property
NodeJsCore.modules = [];

// instance property
NodeJsCore.prototype.modules = NodeJsCore.modules;

NodeJsCore.prototype.Menus = function () {
    var _option = {
        roles: [
            'annonymous'
        ],
        title: '',
        menu: 'main',
        link: '',
        icon: ''
    };

    this.add = function (options) {
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

    this.get = function (options) {
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
};

function Module(name) {
    this.name = name;
    this.menus = NodeJsCore.Singleton.menus;
    this.config = NodeJsCore.Singleton.config;

    util.walk(getModulePath(this.name, 'server'), 'models', null, require);
}

Module.prototype.render = function (view, options, callback) {
    swig.renderFile(getModulePath(this.name, '/server/views/' + view + '.html'), options, callback);
};

Module.prototype.setDefaultTemplate = function (template) {
    NodeJsCore.Singleton.template = template;
};

Module.prototype.routes = function () {
    var args = Array.prototype.slice.call(arguments);
    var that = this;

    util.walk(getModulePath(this.name, 'server'), 'routes', 'middlewares', function (route) {
        require(route).apply(that, [that].concat(args));
    });
};

Module.prototype.angularDependencies = function (dependencies) {
    this.anguarDependencies = dependencies;
    NodeJsCore.modules[this.name].dependencies = dependencies;
};

Module.prototype.register = function (callback) {
    _container.register(this.name, callback);
};

Module.prototype.settings = function () {
    if (!arguments.length) {
        return;
    }

    var NodeJsCore = require('nodejscore');
    var database = NodeJsCore.get('database');

    if (!database || database.connection) {
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

NodeJsCore.prototype.Module = Module;

NodeJsCore.prototype.chainware = {
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

function getModulePath(name, plus) {
    return path.join(process.cwd(), NodeJsCore.modules[name].source, name.toLowerCase(), plus);
}

function findModules(callback) {
    var searchSource = function (source) {
        if (!callback || typeof callback !== 'function') {
            callback = function () {};
        }

        var deferred = q.defer();

        fs.stat(path.join(process.cwd(), source), function (err, stats) {
            if (err) {
                return deferred.reject(err);
            }

            if (stats.isDirectory()) {
                fs.readdir(path.join(process.cwd(), source), function (err, files) {
                    if (err || !files || !files.length) {
                        if (err && err.code !== 'ENOENT') {
                            console.log(err);
                        } else {
                            return deferred.resolve();
                        }

                        return deferred.reject(err);
                    }

                    var promises = [];

                    files.forEach(function (file) {
                        if (file === '.bin' || file === '.DS_Store') {
                            return;
                        }

                        var fileDeferred = q.defer();

                        fs.readFile(path.join(process.cwd(), source, file, 'package.json'), function (err, data) {
                            if (err) {
                                fileDeferred.reject(err);
                            }

                            if (data) {
                                try {
                                    var json = JSON.parse(data.toString());

                                    if (json.dexter) {
                                        NodeJsCore.modules[json.name] = {
                                            version: json.version,
                                            source: source
                                        };
                                    }
                                } catch (err) {
                                    fileDeferred.reject(err);
                                }
                            }

                            fileDeferred.resolve();
                        });

                        promises.push(fileDeferred.promise);
                    });

                    return deferred.resolve(q.all(promises));
                });
            }
        });

        return deferred.promise;
    };

    q.all([
        searchSource('node_modules'),
        searchSource('packages')
    ]).done(function () {
        _events.emit('modulesFound');
        callback();
    }, function (err) {
        console.error('Error loading modules. ', err);
        callback();
    });
}

function enableModules(callback) {
    var name, remaining = 0;

    for (name in NodeJsCore.modules) {
        remaining++;
        require(getModulePath(name, 'app.js'));
    }

    for (name in NodeJsCore.modules) {
        _container.resolve.apply(_container, [name]);
        _container.get(name);
        remaining--;

        if (!remaining) {
            _events.emit('modulesEnabled');

            if (!callback || typeof callback !== 'function') {
                callback = function () {};
            }

            callback(NodeJsCore.modules);
        }
    }
}

(require('./aggregation'))(NodeJsCore);

module.exports = new NodeJsCore();
