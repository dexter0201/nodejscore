'use strict';

const assert = require('assert');

describe('MoudleList', () => {
    var ModuleList = require(process.cwd() + '/lib/core/module/modulelist');

    describe('Constructor', () => {
        var moduleList;

        beforeEach('beforeEach ... create ModuleList instance', () => {
            if (!moduleList) {
                moduleList  = new ModuleList();
            }
        });

        afterEach('afterEach ... destroy', () => {
            moduleList = null;
        });

        it('It should create a ModuleList successful', () => {
            assert.equal('object', typeof moduleList);
        });

        it('It should create a module successful', () => {
            var module = moduleList.createModule('system', '0.1.0', 'packages');

            assert.equal('object', typeof module);
            assert.equal('system', module.name);
            assert.equal('0.1.0', module.version);
            assert.equal('packages', module.source);

            assert.doesNotThrow(function () {
                moduleList.moduleNamed(module.name);
            }, 'Error when check moduledNamed');

            // assert.equal(true, moduleList.moduleNamed(module.name));

            assert.doesNotThrow(function () {
                module.destroy();
            }, 'Error when destroy module');

            assert.equal(null, module.name);
            assert.equal(null, module.version);
            assert.equal(null, module.source);
        });
    });
});
