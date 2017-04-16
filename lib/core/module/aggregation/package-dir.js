var AssetDir = require('./asset-dir');
var inherit = require('../inherit');
const path = require('path');

function PackageDir(ext, rootPath, name, options) {
    AssetDir.call(this, ext, path.join(rootPath, name, 'public'), name, options);
}

inherit(PackageDir, AssetDir);

module.exports = PackageDir;