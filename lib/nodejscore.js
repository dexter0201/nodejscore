'use strict';

var iocContainer = require('nodejs-ioc-container'),
    _container = iocContainer.container(),
    EventEmitter = require('events').EventEmitter,
    util = require('./util');

var _events = new EventEmitter(),
    _middleware = {
        before: {},
        after: {}
    };

function doBootstrap(callback, err) {
    callback = callback || function () {};

    if (err) {
        console.log('Do bootstrap error');
        return callback();
    }

    NodeJsCore.Singleton.config.loadSettings(function () {
        require('./bootstrap')({}, NodeJsCore);
        callback(NodeJsCore.Singleton.app, NodeJsCore.Singleton.config.clean);
    });
}

function NodeJsCore() {
    if (this.active) {
        return;
    }

    NodeJsCore.Singleton = this;

    this.events = _events;
    this.version = require('../package').version;
}

NodeJsCore.events = _events;

NodeJsCore.prototype.serve = function (options, callback) {
    if (this.active) {
        return this;
    }

    NodeJsCore.Singleton.active = true;
    NodeJsCore.Singleton.options = options;
    NodeJsCore.Singleton.config = new NodeJsCore.Config(util.loadConfig());

    NodeJsCore.connectMongoDbs(
        NodeJsCore.Singleton.config.clean,
        doBootstrap.bind(null, callback)
    );
};

NodeJsCore.prototype.loadConfig = util.loadConfig;

NodeJsCore.prototype.status = function () {
    return {
        active: this.active,
        name: this.name
    };
};

NodeJsCore.prototype.register = _container.register;
NodeJsCore.prototype.resolve = _container.resolve;
NodeJsCore.prototype.load = _container.get;
NodeJsCore.prototype.get = _container.get;


NodeJsCore.prototype.moduleEnabled = function (name) {
    return this.modules[name] ? true : false;
};

NodeJsCore.modules = [];

NodeJsCore.prototype.modules = NodeJsCore.modules;

NodeJsCore.prototype.chainware = {
    add: function (event, weight, func) {
        _middleware[event].splice(weight, 0, {
            weight: weight,
            func: func
        });
        _middleware[event].join();
        _middleware[event].sort(function (a, b) {
            if (a.weight < b.weight) {
                a.next = b.func;
            } else {
                b.next = a.func;
            }

            return (a.weight - b.weight);
        });
    },

    before: function (req, res, next) {
        if (!_middleware.before.length) {
            return next();
        }

        this.chain('before', 0, req, res, next);
    },

    after: function (req, res, next) {
        if (!_middleware.after.length) {
            return next();
        }

        this.chain('after', 0, req, res, next);
    },

    chain: function (operator, index, req, res, next) {
        var args = [
            req,
            res,
            function () {
                if (_middleware[operator][index + 1]) {
                    this.chain('before', index + 1, req, res, next);
                } else {
                    next();
                }
            }
        ];

        _middleware[operator][index].func.apply(this, args);
    }
};

(require('./config'))(NodeJsCore);
(require('./menu'))(NodeJsCore);
(require('./module'))(NodeJsCore);
(require('./aggregation'))(NodeJsCore);
(require('./db'))(NodeJsCore);
(require('./flatform'))(NodeJsCore);

module.exports = new NodeJsCore();
