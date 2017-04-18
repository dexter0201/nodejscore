var asyns = true;
var CssFileAsset = require('./css-file-asset');
var JsFileAsset = require('./js-file-asset');
const fs = require('fs');
const path = require('path');
const EXCLUDED_ASSETS = [
    'assets',
    'tests'
];

function AssetDir(ext, dirPath, src, options) {
    this.ext = ext;
    this.path = dirPath;
    this.src = src;
    this.options = options;
    this.readDir();
}

AssetDir.prototype.destroy = function () {
    this.ext = null;
    this.path = null;
    this.src = null;
    this.options = null;
};

AssetDir.prototype.readDir = function () {
    if (!fs.existsSync(this.path)) {
        this.destroy();
        return;
    }

    if (asyns) {
        fs.readdir(this.path, this.onErrorAndItems.bind(this));
    } else {
        this.onItems(fs.readdirSync(this.path));
    }
};

AssetDir.prototype.onErrorAndItems = function (err, items) {
    if (err) {
        this.destroy();
        return;
    }

    this.onItems(items);
};

AssetDir.prototype.onItems = function (items) {
    items.forEach(this.produceAsset.bind(this));
    this.destroy();
};

AssetDir.prototype.produceAsset = function (item) {
    if (EXCLUDED_ASSETS.indexOf(item) < 0) {
        AssetDir.produceAssetFromPath(
            path.join(this.path, item),
            this.ext,
            this.options,
            path.join(this.src, item)
        );
    }
};

AssetDir.produceAssetFromPath = function (fpath, ext, options, src) {
    fpath = fpath.split('?')[0];

    if (!fs.existsSync(fpath)) {
        return;
    }

    var fstats = fs.statSync(fpath);

    if (fstats.isDirectory()) {
        new AssetDir(ext, fpath, src, options);
    } else if (fstats.isFile()) {
        if (path.extname(fpath) !== '.' + ext) {
            return;
        }

        switch (ext) {
            case 'css':
                new CssFileAsset(fpath, src, options);
                break;
            case 'js':
                new JsFileAsset(fpath, src, options);
                break;
        }
    }
};

module.exports = AssetDir;