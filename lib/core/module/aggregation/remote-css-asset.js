var RemoteAsset = require('./remote-asset');
var Asset = require('./asset');
var inherit = require('../inherit');

function RemoteCssAsset(src, options) {
    RemoteAsset.call(this, src, options);
}

inherit(RemoteCssAsset, RemoteAsset);

RemoteCssAsset.prototype.store = Asset.prototype.storeCss;

module.exports = RemoteCssAsset;