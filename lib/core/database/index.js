'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    q = require('q'),
    _ = require('lodash');

function Database(NodeJsCore) {
    NodeJsCore.onInstance(onInstance);

    NodeJsCore.prototype.applyModels = function (modelRegister) {
        for (var i in modelRegister) {
            var item = modelRegister[i];

            if (!item.schema) {
                throw 'No Schema in register model request, can not move on ...';
            }

            if (!item.model) {
                throw 'No model in register model request, can not move on ...';
            }

            if (!item.dbs || item.dbs.length === 0) {
                item.dbs = ['default'];
            }

            if (item.schema instanceof mongoose.Schema) {
                _.uniq(item.dbs.filter(filterDBAliases)).forEach(
                    applyModels.bind(
                        null,
                        item.schema,
                        item.model,
                        item.collection
                    )
                );

                continue;
            }

            item.dbs.forEach(createModelStructure.bind(
                null,
                item.schema,
                item.model,
                item.collection
            ));
        }
    };

    var lazyModelsMap = {};

    NodeJsCore.createModels = function () {
        for (var db in lazyModelsMap) {
            for (var model in lazyModelsMap[db]) {
                var rec = lazyModelsMap[db][model];
                var s = new Schema(rec.fields, rec.options);

                s.methods = rec.methods;
                s.statics = rec.statics;
                rec.virtual.forEach(bindVirtuals.bind(null, s));
                rec.pre.forEach(bindHook.bind(null, s, 'pre'));
                rec.post.forEach(bindHook.bind(null, s, 'post'));
                rec.indices.forEach(bindIndices.bind(null, s));

                var m = applyModels(s, model, rec.collection, db);

                NodeJsCore.Singleton.events.emit('lazy_model_ready', {
                    model: model,
                    db: db,
                    m: m
                });
            }
        }

        NodeJsCore.Singleton.events.emit('lazy_models_ready');
    };

    function createModelStructure(schema, model, collection, db) {
        db = db || 'default';

        if (!lazyModelsMap[db]) {
            lazyModelsMap[db] = {};
        }

        if (!lazyModelsMap[db][model]) {
            lazyModelsMap[db][model] = {pre:[], post:[], virtual: [], indices: []};
        }

        var mc = lazyModelsMap[db][model];

        mc.collection = collection;
        mc.fields = _.merge (mc.fields || {}, schema.fields);
        mc.methods = _.assign (mc.methods || {}, schema.methods);
        mc.statics = _.assign (mc.statics || {}, schema.statics);

        if (schema.options) {
            mc.options = _.assign (mc.options || {}, schema.options);
        }

        if (schema.indices) {
            Array.prototype.push (mc.indices, schema.indices);
        }

        if (schema.pre) {
            mc.pre.push (schema.pre);
        }

        if (schema.virtual) {
            mc.virtual.push (schema.virtual);
        }
    }

    function bindIndices(s, i) {
        s.index(i);
    }

    function bindVirtuals(s, vr) {
        for (var name in vr) {
            var v = s.virtual(name);

            console.log('create virtual ', name);
            if (vr[name].get) {
                v.get(vr[name].get);
            }

            if (vr[name].set) {
                v.set(vr[name].set);
            }
        }
    }

    function bindHook (s, type, rec) {
        for (var name in rec) {
            console.log('create hook', name);
            s[type](name, rec[name]);
        }
    }

    function filterDBAliases (value) {
        return mongoose.aliasNodeJsCoreDBExists(value);
    }

    function applyModels(schema, model, collection, dbalias) {
        mongoose.getNodeJsCoreDBConnection(dbalias).model(model, schema, collection);

        return mongoose.getNodeJsCoreDBConnection(dbalias).model(model);
    }
}

function onInstance(nodejscoreInstance, defer) {
    var defaultConfig = nodejscoreInstance.config.clean,
            database = null,
            dbPromises = [],
            i;

    mongoose.set('debug', defaultConfig.mongoose && defaultConfig.mongoose.debug);
    database = mongoose.connect(defaultConfig.db || '', defaultConfig.dbOptions || {}, function (err) {
        if (err) {
            console.error('Error: ', err.message);

            return console.error('***Could not connect to MongoDB. Please ensure mongod is running and restart NodeJsFrameword App**');
        }

        nodejscoreInstance.register('database', {
            connection: database
        });

        for (i in defaultConfig.dbs) {
            dbPromises.push(connectDatabase(i, defaultConfig.dbs[i]));
        }

        q.allSettled(dbPromises).then(databasesReady.bind(null, defer, database));
    });
}

function connectDatabase(alias, path) {
    var deferred = q.defer(),
        connection = mongoose.createConnection(path);

    connection.once('connected',
        connectDatabaseSuccessCallback.bind(null, deferred, {
            alias: alias,
            connection: connection,
            path: path
        })
    );
    connection.once('error',
        connectDatabaseFailedCallback.bind(null, deferred, {})
    );

    return deferred.promise;
}

function connectDatabaseSuccessCallback(deferred, status) {
    deferred.resolve(status);
}

function connectDatabaseFailedCallback(deferred, status) {
    deferred.reject(status);
}

function databasesReady(defer, database, connection_pool) {
    var aliasMap = {},
        i;

    for (i in connection_pool) {
        if (connection_pool[i].state === 'fulfilled') {
            aliasMap[connection_pool[i].value.alias] = connection_pool[i].value.connection;
        }
    }

    mongoose.getNodeJsCoreDBConnection = function (alias) {
        if (alias === 'default' || !aliasMap[alias]) {
            return database;
        }

        return aliasMap[alias];
    };

    mongoose.aliasNodeJsCoreDBExists = function (alias) {
        return alias === 'default' || !alias || alias in aliasMap;
    };

    defer.resolve();
}

module.exports = Database;
