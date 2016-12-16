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

function sortByWeight(group, ext) {
    var weights = _aggregated[group][ext].weights;
    var temp = [];

    for (var file in weights) {
        temp.push({
            data: weights[file].data,
            weight: weights[file].weight
        });
    }

    _aggregated[group][ext].data = _.map(_.sortBy(temp, 'weight'), function(value) {
        return value.data;
    }).join('\n');
}

function Aggregator(options, libs, debug) {
    this.options = options;
    this.libs = libs;
    this.debug = debug;
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

    fs.readFile(filepath, this.processFileOfFile.bind(this, ext, filepath));
};

Aggregator.prototype.processFileOfFile = function(ext, filepath, fileErr, data){
    if (!data) {
        this.readFiles(ext, filepath);
    } else {
        var filename = filepath.split(process.cwd())[1];

        this.pushAggregateData(ext, filename, data);
    }
};

Aggregator.prototype.pushAggregateData = function (ext, filename, data) {
    var group,
        weight = this.options.weight || 0;

    if (ext === 'js') {
        group = this.options.group || 'footer';

        var code = this.options.global ? data.toString() + '\n' : '(function () { \'use strict\'; ' + data.toString() + ' }())';
        var ugly = uglify.minify(code, {
            fromString: true,
            mangle: false
        });

        _aggregated[group][ext].weights[filename] = {
            weight: weight,
            data: this.debug ? code : ugly.code
        };
    } else {
        group = this.options.group || 'header';

        _aggregated[group][ext].weights[filename] = {
            weight: weight,
            data: data.toString()
        };
    }
};

function supportAggregate(NodeJsCore) {
    NodeJsCore.prototype.aggregated = function (ext, group, callback) {
        if (_aggregated[group][ext].data) {
            return callback(_aggregated[group][ext].data);
        }

        sortAggregatedAssetByWeight();

        callback(_aggregated[group][ext].data);
    };

    NodeJsCore.prototype.rebuildAggregated = function () {
        sortAggregatedAssetByWeight();
    };

    NodeJsCore.prototype.Module.prototype.aggregateAsset = function (type, asset, options) {
        options = options || {};
        asset = options.inline ? asset : (options.absolute ? asset : path.join(NodeJsCore.modules[this.name].source, this.name, 'public/assets/', type, asset));
        NodeJsCore.aggregate(type, asset, options);
    };

    NodeJsCore.onModulesFoundAggregate = function (ext, options, debug) {
        var aggregator = new Aggregator(options, false, debug);

        for (var name in NodeJsCore.modules) {
            aggregator.readFiles(ext, path.join(process.cwd(), NodeJsCore.modules[name].source, name.toLowerCase(), 'public'));
        }
    };

    NodeJsCore.aggregate = function (ext, asset, options, debug) {
        var aggregator;

        options = options || {};

        if (asset) {
            aggregator = new Aggregator(options, true, debug);

            return options.inline ? aggregator.addInlineCode(ext, asset) : aggregator.readFile(ext, path.join(process.cwd(), asset));
        }

        NodeJsCore.events.on('modulesFound', NodeJsCore.onModulesFoundAggregate.bind(null, ext, options));
    };

    NodeJsCore.prototype.aggregate = NodeJsCore.aggregate;
}



module.exports = supportAggregate;
