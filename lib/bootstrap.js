'use strict';

var express = require('express'),
    fs = require('fs'),
    appPath = process.cwd(),
    dexter = require('nodejscore'),
    Grid = require('gridfs-stream'),
    errorHander = require('errorhandler'),
    path = require('path'),
    util = require('./util'),
    appConfig = util.loadConfig();

module.exports = function (options, db) {
    var app;

    dexter.register('app', function (access, database) {
        require(appPath + '/config/express')(app, access.passport, database.connection);

        return app;
    });

    var gfs = new Grid(db.connection.db, db.mongo);

    app = express();

    app.get('/modules/aggregated.js', function (req, res) {
        res.setHeader('content-type', 'text/javascript');

        dexter.aggregated('js', req.query.group ? req.query.group : 'footer', function (data) {
            res.send(data);
        });
    });

    app.get('/bower_components/bootstrap/dist/css/bootstrap.css', themeHandler);

    function themeHandler(req, res) {
        res.setHeader('content-type', 'text/css');

        gfs.files.findOne({
            filename: 'theme.css'
        }, function(err, file) {

            if (!file) {
                fs.createReadStream(appPath + '/bower_components/bootstrap/dist/css/bootstrap.css').pipe(res);
            } else {
                // streaming to gridfs
                var readstream = gfs.createReadStream({
                    filename: 'theme.css'
                });

                //error handling, e.g. file does not exist
                readstream.on('error', function(err) {
                    console.log('An error occurred!', err.message);
                    throw err;
                });

                readstream.pipe(res);
            }
        });
    }

    app.get('/modules/aggregated.css', function (req, res) {
        res.setHeader('content-type', 'text/css');

        dexter.aggregated('css', req.query.group ? req.query.group : 'header', function (data) {
            res.send(data);
        });
    });

    app.use('/packages', express.static(appConfig.root + '/packages'));
    app.use('/bower_components', express.static(appConfig.root + '/bower_components'));

    dexter.events.on('modulesEnabled', function () {
        for (var name in dexter.modules) {
            var staticPath = [
                appConfig.root,
                dexter.modules[name].source,
                name,
                'public'
            ].join('/');

            app.use('/' + name, express.static(staticPath));
        }

        app.route('*').get(function (req, res, next) {
            if (!dexter.template) {
                return next();
            }

            dexter.template(req, res, next);
        });

        app.use(dexter.chainware.after);
        app.use(function (err, req, res, next) {
            if (~err.message.indexOf('not found')) {
                return next();
            }

            // log it
            console.error(err.stack);

            // error page
            res.status(500)
                .render('500', {
                    error: err.stack
                });
        });

        // assume 404 since no middleware responded
        app.use(function(req, res){
            res.status(404)
                .render('404', {
                    url: req.originalUrl,
                    error: 'Not found'
                });
        });

        if (process.env.NODE_ENV === 'development') {
            app.use(errorHander());
        }
    });

    return app;
};
