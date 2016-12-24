'use strict';
var fs = require('fs'),
    crypto = require('crypto'),
    _ = require('lodash'),
    path = require('path'),
    uglify = require('uglify-js');
var _aggregated = {
    header: {
        js: {
            data: null,
            weights: []
        },
        css: {
            data: null,
            weights: []
        }
    },
    footer: {
        js: {
            data: null,
            weights: []
        },
        css: {
            data: null,
            weights: []
        }
    }
};

function sortAggregatedAssetByWeight() {
    for (var region in _aggregated) {
        for (var ext in _aggregated[region]) {
            sortByWeight(region, ext);
        }
    }
}

function appendItem(arr, item) {
    arr.push(item.src);
}

function sortByWeight(group, ext) {
    var weights = _aggregated[group][ext].weights;
    var temp = [], src = [];

    for (var file in weights) {
        temp.push({
            src: file,
            data: weights[file].data,
            weight: weights[file].weight
        });
    }

    var sorted = _.sortBy(temp, 'weight');

    _aggregated[group][ext].data = _.map(sorted, function(value) {
        return value.data;
    }).join('\n');

    _.map(sorted, appendItem.bind(null, src));
    _aggregated[group][ext].src = src;
}

function Aggregator(options, libs, config) {
    this.options = options;
    this.libs = libs;
    this.config = config;
}

Aggregator.prototype.addInlineCode = function (ext, data) {
    var md5 = crypto.createHash('md5'),
        hash;

    md5.update(data);
    hash = md5.digest('hex');
    this.pushAggregateData(ext, hash, data);
};

Aggregator.prototype.readFiles = function (ext, filepath){
    fs.readdir(filepath, this.processDirOfFiles.bind(this, ext, filepath));
};

Aggregator.prototype.processDirOfFiles = function (ext, filepath, err, files) {
    if (err) {
        return;
    }

    files.forEach(this.processFileOfDirOfFiles.bind(this, ext, filepath));
};

Aggregator.prototype.processFileOfDirOfFiles = function (ext, filepath, file) {
    if (!this.libs && (file !== 'assets' && file !== 'tests')) {
        this.readFile(ext, path.join(filepath, file));
    }
};

Aggregator.prototype.readFile = function(ext, filepath) {
    fs.readdir(filepath, this.processDirOfFile.bind(this, ext, filepath));
};

Aggregator.prototype.processDirOfFile = function(ext, filepath, err, files){
    if (files) {
        return this.readFiles(ext, filepath);
    }

    if (path.extname(filepath) !== '.' + ext) {
        return;
    }

    if (this.config.aggregate !== false) {
        fs.readFile(filepath, this.processFileOfFile.bind(this, ext, filepath));
    } else if (fs.existsSync(filepath)) {
        this.processFileOfFile(ext, filepath);
    }
};

Aggregator.prototype.processFileOfFile = function(ext, filepath, fileErr, data){
        var filename = filepath.split(process.cwd())[1] || '/' + filepath;

        this.pushAggregateData(ext, filename, data);
};

Aggregator.prototype.pushAggregateData = function (ext, filename, data) {
    var group = this.options.group || 'footer',
        weight = this.options.weight || 0;

    if (data) {
        switch (ext) {
            case 'js':
                group = this.options.group || 'footer';

                var code = this.options.global ? data.toString() + '\n' : '(function () { ' + data.toString() + ' }());';

                try {
                    var ugly = this.config.debug ? {code : code} : uglify.minify(code, {
                        fromString: true,
                        mangle: false
                    });

                    _aggregated[group][ext].weights[filename] = {
                        weight: weight,
                        data: ugly.code
                    };
                } catch (e) {
                    console.log('Error when minify ' + filename + ' at line: ' + e.line);
                    console.log('Error message: ' + e.message);
                    throw e;
                }
                break;
            case 'css':
                group = this.options.group || 'header';

                _aggregated[group][ext].weights[filename] = {
                    weight: weight,
                    data: data.toString()
                };
                break;
            default:
                console.log('Aggregating other extension: ', ext);
        }
    } else {
        _aggregated[group][ext].weights[filename] = {
            weight: weight
        };
    }
};

function NamespaceAggregate(NodeJsCore) {
    NodeJsCore.prototype.aggregated = function (ext, group, callback) {
        if (NodeJsCore.Singleton.config.clean.aggregate === false) {
            return callback('');
        }

        if (_aggregated[group][ext].data) {
            return callback(_aggregated[group][ext].data);
        }

        sortAggregatedAssetByWeight();

        callback(_aggregated[group][ext].data);
    };

    NodeJsCore.prototype.aggregatedSrc = function (ext, group, callback) {
        if (NodeJsCore.Singleton.config.clean.aggregate !== false) {
            switch (ext) {
                case 'js':
                    var agJsPath = '/modules/aggregated.js' + (group === 'header' ? '?group=header' : '');

                    return callback([agJsPath]);
                case 'css':
                    if (group === 'header') {
                        return callback(['/modules/aggregated.css']);
                    }

                    return callback([]);
                default:
                    return callback([]);
            }
        }

        if (_aggregated[group][ext].src) {
            return callback(_aggregated[group][ext].src);
        }

        sortAggregatedAssetByWeight();
        callback(_aggregated[group][ext].src);
    };

    NodeJsCore.prototype.rebuildAggregated = function () {
        sortAggregatedAssetByWeight();
    };

    NodeJsCore.prototype.Module.prototype.aggregateAsset = function (type, asset, options) {
        options = options || {};
        asset = options.inline ? asset : (options.absolute ? asset : path.join(NodeJsCore.modules[this.name].source, this.name, 'public/assets/', type, asset));
        NodeJsCore.aggregate(type, asset, options, NodeJsCore.Singleton.config.clean);
    };

    NodeJsCore.onModulesFoundAggregate = function (ext, options) {
        var config = NodeJsCore.Singleton.config.clean;
        var aggregator = new Aggregator(options, false, config);

        for (var name in NodeJsCore.modules) {
            aggregator.readFiles(ext, path.join(process.cwd(), NodeJsCore.modules[name].source, name.toLowerCase(), 'public'));
        }
    };

    NodeJsCore.aggregate = function (ext, asset, options, config) {
        if (!asset) {
            return;
        }

        var aggregator;

        options = options || {};
        aggregator = new Aggregator(options, true, config);

        if (options.inline) {
            return aggregator.addInlinecode(ext, asset);
        } else if (options.singleFile) {
            return aggregator.processDirOfFile(ext, asset);
        } else {
            return aggregator.readFile(ext, path.join(process.cwd(), asset));
        }
    };

    NodeJsCore.prototype.aggregate = NodeJsCore.aggregate;
}

module.exports = NamespaceAggregate;
