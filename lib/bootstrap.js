'use strict';

var express = require('express'),
    fs = require('fs'),
    appPath = process.cwd(),
    Grid = require('gridfs-stream'),
    errorHander = require('errorhandler'),
    util = require('./util'),
    appConfig = util.loadConfig(),
    http = require('http'),
    https = require('https');

module.exports = function (NodeJsCore, callback) {
    var app,
        config = NodeJsCore.Singleton.config.clean,
        db = NodeJsCore.Singleton.get('database').connection,
        gfs = new Grid(db.connection.db, db.mongo);

    NodeJsCore.Singleton.register('app', function (access, database) {
        require(appPath + '/config/express')(app, access.passport, database.connection);

        return app;
    });

    app = express();

    if (config.aggregate !== false) {
        var jqueryMinMap = fs.readFileSync(config.root + '/bower_components/jquery/jquery.min.map');

        app.get('/modules/jquery.min.map', function (req, res) {
            res.send(jqueryMinMap);
        });

        app.get('/modules/aggregated.js', function (req, res) {
            res.setHeader('content-type', 'text/javascript');

            NodeJsCore.Singleton.aggregated('js', req.query.group ? req.query.group : 'footer', function (data) {
                res.send(data);
            });
        });
    }

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

    app.get('/bower_components/bootstrap/dist/css/bootstrap.css', themeHandler);

    app.get('/modules/aggregated.css', function (req, res) {
        res.setHeader('content-type', 'text/css');

        NodeJsCore.Singleton.aggregated('css', req.query.group ? req.query.group : 'header', function (data) {
            res.send(data);
        });
    });

    app.use('/bower_components', express.static(appConfig.root + '/bower_components'));

    NodeJsCore.Singleton.events.on('modulesEnabled', function () {
        for (var name in NodeJsCore.Singleton.modules) {
            var staticPath = [
                appConfig.root,
                NodeJsCore.Singleton.modules[name].source,
                name,
                'public'
            ].join('/');

            app.use('/' + name, express.static(staticPath));

            if (NodeJsCore.Singleton.config.clean.aggregate === false) {
                app.use(
                    '/' + NodeJsCore.Singleton.modules[name].source + '/' + name + '/public',
                    express.static([
                        config.root,
                        NodeJsCore.Singleton.modules[name].source,
                        name.toLowerCase(),
                        'public'
                    ].join('/'))
                );
              }
        }

        app.route('*').get(function (req, res, next) {
            if (!NodeJsCore.Singleton.template) {
                return next();
            }

            NodeJsCore.Singleton.template(req, res, next);
        });

        app.use(NodeJsCore.Singleton.chainware.after);
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

    NodeJsCore.Singleton.Module.bootstrapModules(callback);
    NodeJsCore.Singleton.name = config.app.name;
    NodeJsCore.Singleton.app = app;
    NodeJsCore.Singleton.menus = new NodeJsCore.Singleton.Menus();

    var httpServer = http.createServer(NodeJsCore.Singleton.app);

    NodeJsCore.Singleton.register('http', httpServer);
    httpServer.listen(config.http ? config.http.port : config.port, config.hostname);

    if (config.https && config.https.port) {
        var httpsOptions = {
            key: fs.readFileSync(config.https.ssl.key),
            cert: fs.readFileSync(config.https.ssl.cert)
        };
        var httpsServer = https.createServer(httpsOptions, NodeJsCore.Singleton.app);

        NodeJsCore.Singleton.register('https', httpsServer);
        httpsServer.listen(config.https.port);
    }
};
