'use strict';

const DependencyList = require('nodejs-dependency-list');
const Dependency = DependencyList.dependencyConstructor();
const path = require('path');

var inherit = require('./inherit');

function ModuleList() {
    DependencyList.call(this);
}

inherit(ModuleList, DependencyList);

ModuleList.prototype.dependencyConstructor = function () {
    return Module;
};

ModuleList.prototype.createModule = function (name, version, source) {
    return new Module(name, version, source);
};

ModuleList.prototype.moduleNamed = function (name) {
    return this.findOne(function (dep) {
        return name === dep.name;
    });
};

function Module(name, version, source, weight) {
    this.name = name;
    this.version = version;
    this.source = source;
    this.weight = weight;
    Dependency.call(this);
    this.aggregatePackage();
}

inherit(Module, Dependency);

Module.prototype.destroy = function () {
    Dependency.prototype.destroy.call(this);
    this.name = null;
    this.version = null;
    this.source = null;
};

Module.prototype.path = function (extra) {
    return path.join(process.cwd(), this.source, this.name, extra || '');
};

Module.prototype.activate = function () {
    var req = require(this.path('app.js'));

    if (req && typeof req.init === 'function') {
        req.init(this);
    }
};

module.exports = ModuleList;
