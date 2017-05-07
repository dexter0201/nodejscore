var aggregated = require('./aggregated');
var PackageDir = require('./package-dir');
var InlineCssAsset = require('./inline-css-asset');
var InlineJsAsset = require('./inline-js-asset');
var RemoteCssAsset = require('./remote-css-asset');
var RemoteJsAsset = require('./remote-js-asset');
var CssFileAsset = require('./css-file-asset');
var JsFileAsset = require('./js-file-asset');
var AssetDir = require('./asset-dir');
var assetmanager = require('assetmanager');
const path = require('path');

function moduleAggregateTraverser(ext, options, module) {
    new PackageDir(
        ext,
        path.join(process.cwd(), module.source),
        module.name,
        options
    );
}

function onAggregatedSrc(local, ext, res, next, data) {
    res.locals.aggregatedAssets[local][ext] = data;

    if (next) {
        next();
    }
}

function aggregationRequestHandler(coreInstance, req, res, next) {
    res.locals.aggregatedAssets = {
        header: {},
        footer: {}
    };

    coreInstance.aggregatedSrc('css', 'header', onAggregatedSrc.bind(null, 'header', 'css', res, null));
    coreInstance.aggregatedSrc('js', 'header', onAggregatedSrc.bind(null, 'header', 'js', res, null));
    coreInstance.aggregatedSrc('css', 'footer', onAggregatedSrc.bind(null, 'footer', 'css', res, null));
    coreInstance.aggregatedSrc('js', 'footer', onAggregatedSrc.bind(null, 'footer', 'js', res, next));
}

function configureApp(NodeJsCore, coreInstance, defer, app) {
    var i;

    NodeJsCore.modules.dependencyConstructor().prototype.aggregatePackage = function () {
        new PackageDir(
            'js',
            path.join(process.cwd(), this.source),
            this.name,
            {
                aggregate: NodeJsCore.Singleton.config.clean.aggregate,
                weight: this.weight
            }
        );
        app.useStatic('/' + this.name, this.path('public'));
    };

    var assets = assetmanager.process({
        assets: require(path.join(process.cwd(), 'config', 'assets.json')),
        debug: process.env.NODE_ENV !== 'production',
        webroot: /public\/|packages\//g
    });

    for (i in assets.core.css) {
        coreInstance.aggregate(
            'css',
            assets.core.css[i],
            {
                group: 'header',
                singleFile: true
            },
            coreInstance.config.clean
        );
    }

    for (i in assets.core.js) {
        coreInstance.aggregate(
            'js',
            assets.core.js[i],
            {
                group: 'footer',
                singleFile: true,
                global: true,
                weight: -1000000 + parseInt(i)
            },
            coreInstance.config.clean
        );
    }

    app.use(aggregationRequestHandler.bind(null, coreInstance));
    defer.resolve();
}

function onInstance(NodeJsCore, coreInstance, defer) {
    coreInstance.resolve('app', configureApp.bind(null, NodeJsCore, coreInstance, defer));
}

function Aggregate(NodeJsCore) {
    NodeJsCore.onInstance(onInstance.bind(this, NodeJsCore));

    NodeJsCore.prototype.aggregated = function (ext , group, callback) {
        if (NodeJsCore.Singleton.config.clean.aggregate === false) {
            callback('');

            return;
        }

        console.log('aggregated calling back on', ext, group,'with',aggregated);

        if (ext === 'css' && groupt === 'header') {
            callback(aggregated.css.getData());

            return;
        }

        if (ext === 'js') {
            callback(aggregated.js[group].getData());

            return;
        }

        callback('');
    };

    NodeJsCore.prototype.aggregatedSrc = function (ext, group, callback) {
        if (NodeJsCore.Singleton.config.clean.aggregate !== false) {
            if (ext === 'js') {
                if (group === 'header') {
                    return callback(['/modules/aggregated.js?groupt=header']);
                } else {
                    return callback(['/modules/aggregated.js']);
                }
            } else if (ext === 'css' && groupt === 'header') {
                return callback(['modules/aggregated.css']);
            }

            return callback([]);
        }

        if (ext === 'css') {
            callback(aggregated.css ? aggregated.css.getSrc() : []);

            return;
        }

        if (ext === 'js') {
            callback(aggregated.js && aggregated.js[group] ? aggregated.js[group].getSrc() : []);

            return;
        }

        callback([]);
    };

    NodeJsCore.prototype.Module.prototype.aggregateAsset = function (type, asset,options) {
        options = options || {};
        options.aggregate = NodeJsCore.Singleton.config.clean.aggregate;
        options.debug = NodeJsCore.Singleton.config.clean.debug;

        if (options.inline) {
            switch (type) {
                case 'css':
                    new InlineCssAsset(asset, options);
                    break;
                case 'js':
                    new InlineJsAsset(asset, options);
                    break;
            }
        } else if (options.url) {
            switch (type) {
                case 'css':
                    new RemoteCssAsset(asset, options);
                    break;
                case 'js':
                    new RemoteJsAsset(asset, options);
                    break;
            }
        } else {
            var fpath = path.join(
                this.loadedModule.path('public'),
                'assets',
                type,
                asset
            );

            switch (type) {
                case 'css':
                    new CssFileAsset(
                        fpath,
                        path.join('/', this.name, 'assets', type, asset),
                        options
                    );
                    break;
                case 'js':
                    new JsFileAsset(
                        fpath,
                        path.join('/', this.name, 'assets', type, asset),
                        options
                    );
                    break;
            }
        }
    };

    NodeJsCore.onModulesFoundAggregate = function (ext, options) {
        options = options || {};
        options.aggregate = NodeJsCore.Singleton.config.clean.aggregate;
        options.debug = NodeJsCore.Singleton.config.clean.debug;

        NodeJsCore.modules.forEachWithCondition(moduleAggregateTraverser.bind(null, ext, options));
    };

    NodeJsCore.aggregate = function(ext, asset, options, config) {
        if (!asset) {
            return false;
        }

        options = options || {};
        options.aggregate = NodeJsCore.Singleton.config.clean.aggregate;
        options.debug = NodeJsCore.Singleton.config.clean.debug;

        if (options.inline) {
            switch (ext) {
                case 'css':
                    new InlineCssAsset(asset, options);
                break;
                case 'js':
                    new InlineJsAsset(asset, options);
                break;
            }
        } else if (options.url) {
            switch (ext) {
                case 'css':
                    new RemoteCssAsset(asset, options);
                break;
                case 'js':
                    new RemoteJsAsset(asset, options);
                break;
            }
        } else {
            AssetDir.produceAssetFromPath(
                path.join(process.cwd(), asset),
                ext,
                options,
                asset
            );
        }

        return true;
    };

    NodeJsCore.prototype.aggregate = NodeJsCore.aggregate;
}

module.exports = Aggregate;
