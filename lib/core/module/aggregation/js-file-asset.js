var FileAsset = require('./file-asset');
var Asset = require('./asset');
var inherit = require('../inherit');

function JsFileAsset(filePath, src, options) {
    FileAsset.call(this, filePath, src, options);
}

inherit(JsFileAsset, FileAsset);

JsFileAsset.prototype.store = Asset.prototype.storeJs;
JsFileAsset.prototype.minifyData = Asset.prototype.minifyJsData;
JsFileAsset.prototype.processStringData = Asset.prototype.processJsStringData;

module.exports = JsFileAsset;