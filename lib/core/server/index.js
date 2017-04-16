'use strict';

const q = require('q');
const path = require('path');
const Engine = require('./engine');

function serverReady(engine, callback) {
    /*jshint validthis: true*/
    engine.endBootstrap(callback.bind(null, this));
}

function serverWithDb(NodeJsCore, callback, database) {
    /*jshint validthis: true*/
    var engine = Engine.produceEngine(
        this.options.serverEngine || this.config.clean.serverEngine
    );

    engine.beginBootstrap(this, database);
    q.all(this.instanceWaitersQ).done(serverReady.bind(this, engine, callback));
}

function genericServer(NodeJsCore, options, callback) {
    /*jshint validthis: true*/
    if (this.active) {
        callback(this);
        return;
    }

    NodeJsCore.prototype.options = options;
    NodeJsCore.prototype.active = true;
    this.resolve('database', serverWithDb.bind(this, NodeJsCore, callback));
}

function onInstance(NodeJsCore, coreInstance, defer) {
    NodeJsCore.prototype.runInstance = genericServer.bind(coreInstance, NodeJsCore);

    var middleware = {
        before: [],
        after: []
    };

    NodeJsCore.prototype.chainware = {
        add: function (event, weight, func) {
            middleware[event].splice(weight, 0, {
                weight: weight,
                func: func
            });
            middleware[event].join();
            middleware[event].sort(function (a, b) {
                if (a.weight < b.weight) {
                    a.next = b.func;
                } else {
                    b.next = a.func;
                }

                return (a.weight - b.weight);
            });
        },

        before: function (req, res, next) {
            if (!middleware.before.length) {
                return next();
            }

            this.chain('before', 0, req, res, next);
        },

        after: function (req, res, next) {
            if (!middleware.after.length) {
                return next();
            }

            this.chain('after', 0, req, res, next);
        },

        chain: function (operator, index, req, res, next) {
            var args = [
                req,
                res,
                function () {
                    if (middleware[operator][index + 1]) {
                        this.chain('before', index + 1, req, res, next);
                    } else {
                        next();
                    }
                }
            ];

            middleware[operator][index].func.apply(this, args);
        }
    };

    defer.resolve();
}

function Server(NodeJsCore) {
    NodeJsCore.onInstance(onInstance.bind(null, NodeJsCore));
}

module.exports = Server;
