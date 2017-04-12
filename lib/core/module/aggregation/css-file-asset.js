var FileAsset = require('./file-asset');
var Asset = require('./asset');
var inherit = require('../inherit');

function CssFileAsset(filePath, src, options) {
    FileAsset.call(this, filePath, src, options);
}

inherit(CssFileAsset, FileAsset);

CssFileAsset.prototype.store = Asset.prototype.storeCss;

module.exports = CssFileAsset;