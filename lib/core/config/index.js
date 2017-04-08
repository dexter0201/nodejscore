'use strict';

const q = require('q'),
    fs = require('fs'),
    _ = require('lodash');

function Configure(NodeJsCore) {
    NodeJsCore.onInstance(onInstance.bind(null, NodeJsCore));
    NodeJsCore.Config = Config;
}

/**
 * Class Config
 * @param defaultConfig
 * @constructor
 */
function Config(defaultConfig) {
    defaultConfig = defaultConfig || loadConfig();
    this.verbose = {};
    this.original = JSON.flatten(defaultConfig, {
        default: true
    });
    this.clean = null;
    this.diff = null;
    this.flat = null;

    this.createConfigurations(defaultConfig);
}

function loadConfig() {
    var configPath = process.cwd() + '/config/env';

    process.env.NODE_ENV = ~fs.readdirSync(configPath).map(function (file) {
        return file.slice(0, -3);
    }).indexOf(process.env.NODE_ENV) ? process.env.NODE_ENV : 'development';

    return _.extend(
        require(configPath + '/all'),
        require(configPath + '/' + process.env.NODE_ENV) || {}
    );
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

Config.prototype.loadSettings = function (defer) {
    this.loadPackageModel(this.onPackageSettingsLoaded.bind(this, defer));
};

Config.prototype.loadPackageModel = function (callback) {
    Config.NodeJsCore.resolve('database', this.onDatabaseLoadPackageModel.bind(this, callback));
};

Config.prototype.onDatabaseLoadPackageModel = function (callback, database) {
    if (!database || !database.connection) {
        callback(null);

        return;
    }

    if (!database.connection.models.Package) {
        require('./package')(database);
    }

    callback(database.connection.model('Package'));
};

Config.prototype.onPackageSettingsLoaded = function (defer, Package) {
    if (!Package) {
        defer.resolve(this.original);
    }

    Package.findOne({
        name: 'config'
    }, this.onPackageRead.bind(this, defer));
};

Config.prototype.onPackageRead = function (callback, err, doc) {
    // @TODO: rebuild
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

function onInstance(NodeJsCore, coreInstance, defer) {
    Config.NodeJsCore = coreInstance;
    coreInstance.config = new Config();
    coreInstance.register('defaultConfig', coreInstance.config);
    coreInstance.resolve('database', coreInstance.config.loadSettings.bind(coreInstance.config, defer));
}

module.exports = Configure;