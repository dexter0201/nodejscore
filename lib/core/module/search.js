'use strict';

const fs = require('fs');
const q = require('q');
const path = require('path');

function searchSourceForFindModules(_modules, disabled, source) {
    var deferred = q.defer();

    fs.readdir(
        path.join(process.cwd(), source),
        processDirFilesFromSearchSource.bind(null, _modules, disabled, source, deferred)
    );

    return deferred.promise;
}

function processDirFilesFromSearchSource(_modules, disabled, source, deferred, err, files) {
    if (err || !files || !files.length) {
        if (err && err.code !== 'ENOENT') {
            console.log(err);
        } else {
            return deferred.resolve();
        }

        return deferred.reject(err);
    }

    var promises = [];

    for (var i in disabled) {
        var index = files.indexOf(i);

        if (index > -1) {
            files.splice(index, 1);
        }
    }

    files.forEach(fileForEachProcess.bind(null, _modules, source, promises));
    return deferred.resolve(q.all(promises));
}

function fileForEachProcess(_modules, source, promises, file) {
    var fileDefer = q.defer();

    fs.readFile(
        path.join(process.cwd(), source, file, 'package.json'),
        readModulePackageJSONFileDone.bind(null, _modules, fileDefer, file, source)
    );

    promises.push(fileDefer.promise);
}

function readModulePackageJSONFileDone(_modules, fileDefer, file, source, err, data) {
    if (data) {
        try {
            var json = JSON.parse(data.toString);

            if (json.dexter) {
                fs.readFile(
                    path.join(process.cwd(), source, file, 'dexter.json'),
                    readModuleDexterJSONFileDone.bind(
                        null,
                        _modules,
                        fileDefer,
                        _modules.createModule(
                            json.name,
                            json.version,
                            json.source
                        ),
                        file,
                        source
                    )
                );

                return;
            }
        } catch (e) {
            fileDefer.reject(e);

            return;
        }

        fileDefer.resolve();
    } else {
        fileDefer.resolve();
    }
}

function readModuleDexterJSONFileDone(_modules, fileDefer, dependency, file, source, err, data) {
    var depObj = {};

    if (data) {
        try {
            var json = JSON.parse(data.toString());

            if (json.dependencies) {
                dependency.cloneDependencies(json.dependencies);
            }
        } catch (e) {
            console.log(file, ' dexter json error', e);
        }
    }

    _modules.add(dependency);
    fileDefer.resolve();
}

module.exports = searchSourceForFindModules;
