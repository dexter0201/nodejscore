'use strict';

var defaultEngine = 'express';

function ServerEngine() {
}

ServerEngine.prototype.getEngineName = function () {
    return 'undefined yet';
};

ServerEngine.prototype.destroy = function () {
    console.log('destroying ServerEngine Instance');
};

ServerEngine.prototype.beginBootstrap = function () {
    throw Error('must be overridden');
};

ServerEngine.prototype.endBootstrap = function () {
    throw Error('must be overridden');
};

ServerEngine.produceEngine = function (engineName) {
    var engine;

    switch (engineName || defaultEngine) {
        case defaultEngine:
            engine = new (require('./express-engine'))();
            break;
        default:
            throw 'Server Engine ' + engineName + ' not supported';
    }

    return engine;
};

module.exports = ServerEngine;
