var InlineAsset = require('./inline-asset');
var Asset = require('./asset');
var inherit = require('../inherit');
var SCRIPT_FORMAT = '<script language="javascript">\n{src}\n</script>';

function InlineJsAsset(src, options) {
    InlineAsset.call(this, SCRIPT_FORMAT.replace('{src}', src), src, options);
}

inherit(InlineJsAsset, InlineAsset);

InlineJsAsset.prototype.store = Asset.prototype.storeJs;

InlineJsAsset.prototype.processStringData = Asset.prototype.processJsStringData;

module.exports = InlineJsAsset;