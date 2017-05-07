var List = require('nodejs-linked-list');
var inherit = require('../inherit');

function WeightedList() {
    List.call(this, function (a, b) {
        return a.options.weight >= b.options.weight;
    });
    this.data = '';
    this.src = [];
    this.dirty = false;
}

inherit(WeightedList, List);

WeightedList.prototype.add = function (content) {
    this.dirty = true;
    List.prototype.add.call(this, content);
};

WeightedList.prototype.getData = function () {
    if (this.dirty) {
        this.buildScalars();
    }

    return this.data;
};

WeightedList.prototype.buildScalars = function () {
    this.data = '';
    this.src = [];
    this.forEachWithCondition(this.addToScalars.bind(this));
    this.dirty = false;
};

WeightedList.prototype.addToScalars = function (content) {
    if (!content) {
        return;
    }

    if (content.src) {
        this.src.push(content.src);
    }

    if (content.data) {
        if (this.data) {
            this.data += '\n';
        }

        this.data += content.data;
    }
};

WeightedList.prototype.getSrc = function () {
    if (this.dirty) {
        this.buildScalars();
    }

    return this.src;
};

module.exports = WeightedList;