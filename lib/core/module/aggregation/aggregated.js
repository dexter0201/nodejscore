'use strict';

var WeightedList = require('./weighted-list');

module.exports = {
    css: new WeightedList(),
    js: {
        header: new WeightedList(),
        footer: new WeightedList()
    }
};