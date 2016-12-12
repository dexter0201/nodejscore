'use strict';

var fs = require('fs'),
    path = require('path'),
    glob = require('glob'),
    _ = require('lodash');

function walk(wpath, type, excludeDir, callback) {
    wpath = path.join(wpath, type);

    if (!fs.existsSync(wpath)) {
        return;
    }

    fs.readdirSync(wpath).forEach(function (file) {
        var newPath = wpath + '/' + file;
        var stat = fs.statSync(newPath);

        if (stat.isFile() && /(.*)\.(js|coffee)$/.test(file)) {
            callback(newPath);
        } else if (stat.isDirectory() && file !== excludeDir) {
            walk(newPath, type, excludeDir, callback);
        }
    });
}

function preload(gpath, type) {
    glob.sync(gpath, function (file) {
        walk(file, type, null, require);
    });
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

JSON.flatten = function(data, options) {
    var result = {};
    flatten(data, '');

    function flatten(config, root) {
        for (var index in config) {
            if (config[index] && !config[index].value && typeof(config[index]) === 'object') {
                flatten(config[index], layerRoot(root, index));
            } else {
                result[layerRoot(root, index)] = {
                    'value': config[index]
                };

                if (options['default']) {
                    result[layerRoot(root, index)]['default'] = config[index];
                }

            }
        }
    }

    function layerRoot(root, layer) {
        return (root ? root + '.' : root) + layer;
    }
    return result;
};

JSON.unflatten = function(data) {
    if (Object(data) !== data || Array.isArray(data))
        return data;
    var regex = /\.?([^.\[\]]+)|\[(\d+)\]/g,
        resultholder = {};
    for (var p in data) {
        var cur = resultholder,
            prop = '',
            m;
        while (m = regex.exec(p)) {
            cur = cur[prop] || (cur[prop] = (m[2] ? [] : {}));
            prop = m[2] || m[1];
        }
        cur[prop] = data[p];
    }
    return resultholder[''] || resultholder;
};


module.exports.walk = walk;
module.exports.preload = preload;
module.exports.loadConfig = loadConfig;
