'use strict';

var fs = require('fs'),
    path = require('path');

var baseRgx = /(.*)(js|coffee)$/;

function walk(wpath, type, excludeDir, callback) {
    wpath = path.join(wpath, type);

    if (!fs.existsSync(wpath)) {
        return;
    }

    var rgx = new RegExp('(.*)-' + type + '(s?).(js|coffee)$', 'i');

    fs.readdirSync(wpath).forEach(function (file) {
        var newPath = wpath + '/' + file;
        var stat = fs.statSync(newPath);

        if (stat.isFile()
            && (rgx.test(file) || baseRgx.test(file))
            && ~newPath.indexOf(type)
        ) {
            callback(newPath);
        } else if (stat.isDirectory()
            && file !== excludeDir
            && ~newPath.indexOf(type)
        ) {
            walk(newPath, type, excludeDir, callback);
        }
    });
}

module.exports.walk = walk;
