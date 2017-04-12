var Asset = require('./asset');
var inherit = require('../inherit');

function InlineAsset(src, data, options) {
    Asset.call(this, src, options);
    processData(data);
}

inherit(InlineAsset, Asset);

function processData() {
    throw new Error('inline-asset -> process Data has not built yet');
}

module.exports = InlineAsset;