'use strict';

var q = require('q'),
    path = require('path'),
    fs = require('fs'),
    swig = require('swig'),
    _ = require('lodash'),
    util = require('./util');

function NamespaceModule(NodeJsCore) {
    function Module(name) {
        this.name = name;
        this.menus = NodeJsCore.Singleton.menus;
        this.config = NodeJsCore.Singleton.config;

        util.walk(getModulePath(this.name, 'server'), 'models', null, requireModel);
    }

    /*****************************************************************/
    function findModules(callback) {
        var disabled = _.toArray(NodeJsCore.Singleton.config.clean);

        q.all([
            searchSourceForFindModules('node_modules', disabled),
            searchSourceForFindModules('packages', disabled)
        ]).done(findModulesDone.bind(null, callback), findModulesError.bind(null, callback));
    }

    function enableModules(callback) {
        var name, remaining = 0;

        for (name in NodeJsCore.modules) {
            remaining++;
            require(getModulePath(name, 'app.js'));
        }

        for (name in NodeJsCore.modules) {
            NodeJsCore.Singleton.resolve(name);
            NodeJsCore.Singleton.get(name);
            remaining--;

            if (!remaining) {
                NodeJsCore.createModels();
                NodeJsCore.Singleton.events.emit('modulesEnabled');
                callback();
            }
        }
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

    Module.prototype.register = function (callback) {
        NodeJsCore.Singleton.register(this.name, callback);
    };

    Module.prototype.angularDependencies = function (dependencies) {
        this.anguarDependencies = dependencies;
        NodeJsCore.modules[this.name].dependencies = dependencies;
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

    function requireModel(path) {
        var model = require(path);

        if (model.register) {
            NodeJsCore.applyModels(model.register);
        }
    }

    function findModulesDone(callback) {
        NodeJsCore.onModulesFoundAggregate('js', {});
        callback();
    }

    function findModulesError(callback, err) {
        console.log('Error when loading modules: ', err);
        callback();
    }

    function searchSourceForFindModules(source, disabled) {
        var deferred = q.defer();

        fs.readdir(
            path.join(process.cwd(), source),
            processDirFilesFromSearchSource.bind(null, source, deferred, disabled)
        );

        return deferred.promise;
    }

    function processDirFilesFromSearchSource(source, deferred, disabled, err, files) {
        if (err || !files || !files.length) {

            if (err && err.code === 'ENOENT') {
                console.log(err);
            } else {
                deferred.resolve();
            }

            return deferred.reject(err);
        }

        var promises = [];

        for (var i in disabled) {
            var index = files.indexOf(disabled[i]);

            if (index < 0) {
                continue;
            }

            files.splice(index, 1);
        }

        files.forEach(fileForEachProcess.bind(null, source, promises));

        return deferred.resolve(q.all(promises));
    }

    function fileForEachProcess(source, promises, file) {
        var deferred = q.defer(),
            filePath = path.join(process.cwd(), source, file, 'package.json');

        fs.readFile(
            filePath,
            readModuleFileDone.bind(null, deferred, file, source)
        );

        promises.push(deferred.promise);
    }

    function readModuleFileDone(deferred, file, source, err, data) {
        if (data) {
            try {
                var json = JSON.parse(data.toString());

                if (json.dexter) {
                    NodeJsCore.modules[json.name] = {
                        version: json.version,
                        source: source,
                        weight: json.weight || 99999
                    };
                }
            } catch (err) {
                deferred.reject(err);
            }
        }

        deferred.resolve();
    }

    function getModulePath(name, plus) {
        return path.join(process.cwd(), NodeJsCore.modules[name].source, name.toLowerCase(), plus);
    }

    /*****************************************************************/

    NodeJsCore.prototype.Module = Module;
}

module.exports = NamespaceModule;
