'use strict';

var fs = require('fs'),
    path = require('path');

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

module.exports.walk = walk;
