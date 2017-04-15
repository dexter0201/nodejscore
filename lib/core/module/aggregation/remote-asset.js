var Asset = require('./asset');
var inherit = require('../inherit');
const request = require('request');

function RemoteAsset(src, options) {
    Asset.call(this, src, options);
    this.fetchData();
}

inherit(RemoteAsset, Asset);

RemoteAsset.prototype.fetchData = function () {
    request(this.src, this.onRemoteData.bind(this));
};

RemoteAsset.prototype.onRemoteData = function (err, res, body) {
    if (!err && res.statusCode === 200) {
        this.processStringData(body);
    } else {
        this.destroy();
    }
};

module.exports = RemoteAsset;