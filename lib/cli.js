'use strict';

var fs = require('fs');
var chalk = require('chalk');

var pkgTypes = {
    contrib: 'contrib',
    custom: 'custom',
    core: 'core'
};

module.exports.list = function () {
    requireRoot(function () {
        console.log(chalk.green('    NodeJsCore Packages List:'));
        console.log('    --------------------');

        function look(type) {
            var path = './packages/' + type + '/';

            fs.readdir(path, function (err, files) {
                if (err || !files.length) {
                    console.log(chalk.red('readir err: ' + err.message));
                }

                files.forEach(function (file) {
                    loadPackageJson(path + file + '/package.json', function (err, data) {
                        if (!err && data.dexter) {
                            console.log(getPackageInfo(type, data));
                        }
                    });
                });
            });
        }

        look('core');
        look('contrib');
        look('custom');
    });
};

function requireRoot(callback) {
    loadPackageJson(process.cwd() + '/package.json', function (err, data) {
        if (err || (data.name !== 'dexter' && !data.dexter)) {
            console.log(chalk.yellow('Invalid Dexter NodeJsCore App or not in app root'));
        } else {
            callback();
        }
    });
}

function loadPackageJson(path, callback) {
    fs.readFile(path, function (err, data) {
        if (err) {
            return callback(err);
        }

        try {
            var pkg = JSON.parse(data.toString());

            pkg.dexterVersion = pkg.dexter || pkg.version;
            callback(null, pkg);
        } catch (e) {
            return callback(err);
        }

    });
}

function getPackageInfo(type, data) {
    if (!data) {
        return;
    }

    var author = data.author ? chalk.green(' Author:  ') + data + author.name : '';

    if (type === pkgTypes.custom && data.author.name === 'Dexter Nguyen') {
        type = pkgTypes.core;
    }

    return chalk.green('    ' + type + ': ') + data.name + '@' + data.version + author;
}
