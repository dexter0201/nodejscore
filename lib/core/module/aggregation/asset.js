const uglify = require('uglify-js');
var aggregated = require('./aggregated');

function Asset(src, options) {
    this.src = src;
    this.options = options;
    this.data = null;

    if (!this.options.weight) {
        this.options.weight = 0;
    }
}

Asset.prototype.destroy = function () {
    this.src = null;
    this.options = null;
    this.data = null;
};

Asset.prototype.minifyData = function (stringData) {
    this.data = stringData;
};

Asset.prototype.minifyJsData = function (stringData) {
    var ugly;

    try {
        ugly = uglify.minify(stringData, {
            fromString: true,
            mangle: false
        });
        this.data = ugly.code;
    } catch (e) {
        console.log('\n\nError in ', stringData, ' on line', e.line);
        console.log(e.message);
        throw e;
    }
};

Asset.prototype.storeCss = function () {
    aggregated.css.add(this);
};

Asset.prototype.storeJs = function () {
    aggregated.js[this.getJsGroup()].add(this);
};

Asset.prototype.getJsGroup = function () {
    return this.options.group || 'footer';
};

Asset.prototype.shouldAggregate = function () {
    return this.options.aggregate !== false;
};

Asset.prototype.shouldMinify = function () {
    return this.options.debug !== true;
};

Asset.prototype.isGlobal = function () {
    return this.options.global === true;
};

Asset.prototype.processStringData = function (stringData) {
    if (this.shouldAggregate()) {
        if (stringData.length) {
            this.aggregateStringData(stringData);
        } else {
            console.log('Processing Data : Data is of 0 length');
        }
    }

    this.store();
};

Asset.prototype.processJsStringData = function (stringData) {
    if (!stringData || !stringData.length) {
        this.destroy();

        return;
    }

    if (!this.isGlobal()) {
        stringData = '(function () { ' + + stringData + ' })();';
    }

    Asset.prototype.processStringData.call(this, stringData);
};

Asset.prototype.store = function () {
    throw new Error('This method must be overridden');
};

Asset.prototype.aggregateStringData = function (stringData) {
    if (this.shouldMinify()) {
        this.minifyJsData(stringData);
    } else {
        this.data = stringData;
    }
};

module.exports = Asset;