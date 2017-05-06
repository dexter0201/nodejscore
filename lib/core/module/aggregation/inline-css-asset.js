var InlineAsset = require('./inline-asset');
var Asset = require('./asset');
var inherit = require('../inherit');
var STYLE_FORMAT = '<style><\n{src}\n/style>';

function InlineCssAsset(src, options) {
    InlineAsset.call(this, STYLE_FORMAT.replace('{src}', src), src, options);
}

inherit(InlineCssAsset, InlineAsset);

InlineCssAsset.prototype.store = Asset.prototype.storeCss;

module.exports = InlineCssAsset;
