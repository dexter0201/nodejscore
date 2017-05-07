'use strict';

const q = require('q');
const swig = require('swig');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');

var util = require('./util'),
    ModuleList = require('./modulelist'),
    search = require('./search'),
    _modules = new ModuleList();

function NamespaceModules(NodeJsCore) {
    NodeJsCore.onInstance(onInstance);
    NodeJsCore.prototype.moduleEnabled = function (name) {
        return !!this.modules[name];
    };

    // Static property
    NodeJsCore.modules = _modules;
    // Instance property
    NodeJsCore.prototype.modules = NodeJsCore.modules;
    NodeJsCore.prototype.exportableModulesList = [];

    function onModuleAngularDependenciesRegistered(callback) {
        NodeJsCore.createModels();
        callback();
    }

    function requireModel(path) {
        var model = require(path);

        if (model.register) {
            NodeJsCore.applyModels(model.register);
        }
    }

    function Module(name) {
        this.loadedModule = NodeJsCore.modules.moduleNamed(name);

        if (!this.loadedModule) {
            NodeJsCore.modules.logs();
            throw new Error('Module with name ' + name + ' is not loaded');
        }

        this.name = this.loadedModule.name.toLowerCase();
        this.menus = NodeJsCore.Singleton.menus;
        this.config = NodeJsCore.Singleton.config;

        // bootstrap models
        util.walk(
            this.loadedModule.path('server'),
            'models',
            null,
            requireModel
        );
    }

    Module.prototype.render = function (view, options, callback) {
        swig.renderFile(
            getModulePath(
                this.name,
                '/server/views/' + view + '.html'
            ),
            options,
            callback
        );
    };

    function getModulePath(name, plus) {
        return path.join(
            process.cwd(),
            NodeJsCore.modules[name].source,
            name.toLowerCase(),
            plus
        );
    }

    Module.prototype.setDefaultTemplate = function (template) {
        NodeJsCore.Singleton.template = template;
    };

    Module.prototype.routes = function () {
        var args = Array.prototype.slice.call(arguments);

        util.walk(
            this.loadedModule.path('server'),
            'routes',
            'middlewares',
            this.onRoute.bind(this, [this].concat(args))
        );
    };

    Module.prototype.onRoute = function (args, route) {
        require(route).apply(this, args);
    };

    Module.prototype.register = function (callback) {
        NodeJsCore.Singleton.register(this.name, callback);
    };

    Module.prototype.angularDependencies = function (dependencies) {
        this.angularDependencies = dependencies;
        this.loadedModule.angularDependencies = dependencies;
    };

    Module.prototype.settings = function () {
        if (!arguments.length) {
            return;
        }

        var database = NodeJsCore.Singleton.get('database');

        if (!database || database.connection) {
            return {
                err: true,
                message: 'No database connection'
            };
        }

        if (!database.connection.models.Package) {
            require('../modules/package')(database);
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

    Module.bootstrapModules = function (callback) {
        findModules(enableModules.bind(null, callback));
    };

    NodeJsCore.prototype.Module = Module;
    require('./aggregation')(NodeJsCore);
}

function onInstance(coreInstance, defer) {
    coreInstance.resolve('app', findModules.bind(null, coreInstance, defer));
}

function findModules(coreInstance, defer, app) {
    var disabled = _.toArray(coreInstance.config.clean.disabledModules);

    q.all([
        search(_modules, disabled, 'node_modules'),
        search(_modules, disabled, 'packages')
    ]).done(
        findModulesDone.bind(null, coreInstance, defer, app),
        findModulesError.bind(null, defer)
    );
}

function findModulesDone(coreInstance, defer, app) {
    var config = coreInstance.config.clean;

    app.get('/_getModules', getModulesHandler.bind(null, coreInstance));

    if (config.aggregation !== false) {
        var jqueryMinMap = fs.readFileSync(
            config.root + '/bower_components/jquery/jquery.min.map'
        );

        app.get(
            '/modules/jquery.min.map',
            jQueryMinMapHandler.bind(null, jqueryMinMap)
        );
        app.get(
            '/modules/aggregated.js',
            aggregatedJsHandler.bind(null, coreInstance)
        );

        app.get(
            '/modules/aggregated.css',
            aggregatedCssHandler.bind(null, coreInstance)
        );
        app.useStatic('/bower_components', config.root + '/bower_components');
    }

    if (!_modules.unResolved.empty()) {
        throw new Error(
            'Packages with unResolved dependencies: ' + _modules.listOfUnResolved()
        );
    }

    enableModules(coreInstance, defer);
}

function findModulesError(defer, err) {
    console.log('Error loading modules: ', err);
    defer.resolve();
}

function getModulesHandler(coreInstance, req, res) {
    res.json(coreInstance.exportableModulesList);
}

function jQueryMinMapHandler(jqueryMinMap, req, res) {
    res.send(jqueryMinMap);
}

function aggregatedJsHandler(coreInstance, req, res) {
    res.setHeader('content-type', 'text/javascript');
    coreInstance.aggregated(
        'js',
        req.query.group || 'footer',
        aggregatedJsSender.bind(null, res)
    );
}

function aggregatedJsSender(res, data) {
    res.send(data);
}

function aggregatedCssHandler(coreInstance, req, res) {
    res.setHeader('content-type', 'text/css');
    coreInstance.aggregated(
        'css',
        req.query.group || 'header',
        aggregatedCssSender.bind(null, res)
    );
}

function aggregatedCssSender(res, data) {
    res.send(data);
}

function enableModules(coreInstance, defer) {
    var defers = [];

    _modules.forEach(moduleActivator.bind(null, coreInstance, defers));
    q.all(defers).done(onModulesEnabled.bind(null, coreInstance, defer));
}

function moduleActivator(coreInstance, defers, loadedModule) {
    if (loadedModule) {
        var defer = q.defer();

        defers.push(defer);
        loadedModule.activate();
        coreInstance.resolve(loadedModule.name, defer.resolve.bind(defer));
    }
}

function onModulesEnabled(coreInstance, defer) {
    _modules.forEach(moduleRegistration.bind(null, coreInstance));
    defer.resolve();
}

function moduleRegistration(coreInstance, loadedModule) {
    if (loadedModule) {
        coreInstance.exportableModulesList.push({
            name: loadedModule.name,
            angularDependencies: loadedModule.angularDependencies
        });
    }
}

module.exports = NamespaceModules;
