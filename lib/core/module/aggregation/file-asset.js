var Asset = require('./asset');
var fs = require('fs');
var async = true;
var inherit = require('../inherit');

function FileAsset(filePath, src, options) {
    if (src.charAt(0) !== '/') {
        src = '/' + src;
    }

    this.path = filePath;
    Asset.call(this, src, options);
    this.read();
}

inherit(FileAsset, Asset);

FileAsset.prototype.destroy = function () {
    Asset.prototype.destroy.call(this);
    this.path = null;
};

FileAsset.prototype.read = function () {
    if (!fs.existsSync(this.path)) {
        console.log(this.path, ' not found');
        this.destroy();

        return;
    }

    if (async) {
        fs.readFile(this.path, this.onErrorAndData.bind(this));
    } else {
        this.onData(fs.readFileSync(this.path));
    }
};

FileAsset.prototype.onErrorAndData = function (err, data) {
    if (err) {
        return;
    }

    this.onData(data);
};

FileAsset.prototype.onData = function (data) {
    this.processStringData(data.toString());
};

FileAsset.prototype.aggregateData = function (stringData) {
    console.log('FileAsset.prototype.aggregateData has not implemented yet. ', stringData);
};

module.exports = FileAsset;