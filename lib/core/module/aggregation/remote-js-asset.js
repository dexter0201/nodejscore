var RemoteAsset = require('./remote-asset');
var Asset = require('./asset');
var inherit = require('../inherit');

function RemoteJsAsset(src, options) {
    RemoteAsset.call(this, src, options);
}

inherit(RemoteJsAsset, RemoteAsset);

RemoteJsAsset.prototype.store = Asset.prototype.storeJs;
RemoteJsAsset.prototype.processStringData = Asset.prototype.processJsStringData;

module.exports = RemoteJsAsset;