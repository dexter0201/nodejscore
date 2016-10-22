(function () {
    'use strict';

    const mongoose = require('mongoose');
    var Schema = mongoose.Schema;

    var PackageSchema = new Schema({
        name: String,
        settings: {},
        updated: {
            type: Date,
            default: Date.now
        }
    });

    mogoose.model('Package', PackageSchema);
}());
