'use strict';

var fs = require('fs'),
    path = require('path'),
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


module.exports.walk = walk;
module.exports.loadConfig = loadConfig;
