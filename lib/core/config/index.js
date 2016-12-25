'use strict';

function NamespaceConfig(NodeJsCore) {
    function Config(defaultConfig) {
        this.verbose = {};
        this.original = JSON.flatten(defaultConfig, {
            default: true
        });
        this.clean = null;
        this.diff = null;
        this.flat = null;

        this.createConfigurations(defaultConfig);
    }

    Config.prototype.createConfigurations = function (config) {
        var saved = JSON.flatten(config, {});
        var merged = mergeConfig(this.original, saved);
        var clean = JSON.unflatten(merged.clean, {});
        var diff = JSON.unflatten(merged.diff, {});

        this.verbose = {
            clean: clean,
            diff: diff,
            flat: merged
        };
        this.clean = clean;
        this.diff = diff;
        this.flat = merged;
    };

    Config.prototype.loadSettings = function (callback) {
        var Package = this.loadPackageModel();

        if (!Package) {
            return callback ? callback(this.original) : undefined;
        }

        Package.findOne({
            name: 'config'
        }, this.onPackageRead.bind(this, callback));
    };

    Config.prototype.loadPackageModel = function () {
        var database = NodeJsCore.Singleton.get('database');

        if (!database || !database.connection) {
            return null;
        }

        if (!database.connection.models.Package) {
            require('./package')(database);
        }

        return database.connection.model('Package');
    };

    Config.prototype.onPackageRead = function (callback, err, doc) {

        callback = callback || function () {};

        if (err) {
            return callback(err);
        }

        if (!doc || !doc.settings) {
            return callback();
        }

        this.createConfigurations(doc.settings);
        callback();
    };

    Config.prototype.updateSettings = function (name, settings, callback) {
        var Package = this.loadPackageModel();

        callback = callback || function () {};

        if (!Package) {
            return callback(new Error('Failed to update settings'));
        }

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
                return callback(new Error('Failed to udpate settings'));
            }

            return callback(null, doc);
        });
    };

    Config.prototype.getSettings = function (name, callback) {
        var Package = this.loadPackageModel();

        callback = callback || function () {};

        if (!Package) {
            return callback(new Error('Failed to retrieve settings'));
        }

        Package.findOne({
            name: name
        }, function (err, doc) {
            if (err) {
                console.log(err);
                return callback(new Error('Failed to retrieve settings'));
            }

            return callback(null, doc);
        });
    };

    Config.prototype.update = function (settings, callback) {
        var Package = this.loadPackageModel();

        callback = callback || function () {};

        if (!Package) {
            return callback(new Error('Failed to load data model'));
        }

        Package.findOneAndUpdate({
            name: 'config'
        }, {
            $set: {
                settings: settings,
                updated: new Date()
            }
        }, {
            upsert: true,
            new: true,
            multi: false
        }, this.onPackageRead.bind(this, callback));
    };

    function mergeConfig(original, saved) {
        var clean = {};

        for (var index in saved) {
            clean[index] = saved[index].value;

            if (original[index]) {
                original[index].value = saved[index].value;
            } else {
                original[index] = {
                    value: saved[index].value
                };
            }

            original[index]['default'] = original[index]['default'] || saved[index]['default'];
        }

        return {
            diff: original,
            clean: clean
        };
    }

    NodeJsCore.Config = Config;
}

module.exports = NamespaceConfig;