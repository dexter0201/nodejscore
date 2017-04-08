'use strict';

const Container = require('nodejs-ioc-container').Container;
const q = require('q');

function NodeJsCore() {
    var defer;

    Container.call(this);

    if (this.active) {
        return;
    }

    NodeJsCore.Singleton = this;
    this.version = require('../package').version;
    this.instanceWaitersQ = [];

    while (NodeJsCore.instanceWaiters.length) {
        defer = q.defer();
        NodeJsCore.instanceWaiters.shift()(this, defer);
        this.instanceWaitersQ.push(defer.promise);
    }
}

NodeJsCore.prototype = Object.create(Container.prototype, {
    'constructor': {
        value: NodeJsCore,
        enumerable: false,
        writable: false,
        configurable: false
    }
});

NodeJsCore.prototype.status = function () {
    return {
        active: this.active,
        name: this.name
    };
};

NodeJsCore.prototype.loadConfig = function () {
    return this.config.clean;
};

NodeJsCore.instanceWaiters = [];
NodeJsCore.onInstance = function (func) {
    NodeJsCore.instanceWaiters.push(func);
};

(require('./core/config'))(NodeJsCore);
(require('./menu'))(NodeJsCore);
(require('./core/module'))(NodeJsCore);
(require('./core/database'))(NodeJsCore);
(require('./core/server'))(NodeJsCore);

module.exports = new NodeJsCore();
