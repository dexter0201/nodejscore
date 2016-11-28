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

module.exports = function (passport, db) {
    var app;

    require('./util').walk(appPath + '/server', 'models', null, function (model) {
        require(model);
    });
    require(appPath + '/server/config/passport')(passport);
    dexter.register('passport', function () {
        return passport;
    });
    dexter.register('auth', function () {
        require(appPath + '/server/routes/middlewares/authorization');
    });
    dexter.register('database', {
        connection: db
    });
    dexter.register('app', function () {
        return app;
    });

    var gfs = new Grid(db.connection.db, db.mongo);

    app = express();
    require(appPath + '/server/config/express')(app, passport, db);
    app.get('/modules/aggregated.js', function (req, res) {
        res.setHeader('content-type', 'text/javascript');
        res.send(dexter.aggregated.js);
    });

    app.get('/public/lib/bootstrap/css/bootstrap.css', themeHandler);

    function themeHandler(req, res) {
        res.setHeader('content-type', 'text/css');

        gfs.files.findOne({
            filename: 'theme.css'
        }, function(err, file) {

            if (!file) {
                fs.createReadStream(appPath + '/public/lib/bootstrap/css/bootstrap.css').pipe(res);
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
        res.send(dexter.aggregated.css);
    });

    app.use('/public', express.static(appConfig.root + 'public'));

    dexter.events.on('modulesEnabled', function () {
        for (var name in dexter.modules) {
            var staticPath = [
                appConfig.root,
                dexter.modules[name].source,
                'public'
            ].join('/');

            app.use('/' + name, express.static(staticPath));
        }

        util.walk(path.join(appPath, 'server'), 'routes', 'middlewares', function (route) {
            require(route)(app, passport);
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
