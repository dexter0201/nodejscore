'use strict';

var Engine = require('./engine');

const express = require('express');
const fs = require('fs');
const appPath = process.cwd();
const Grid = require('gridfs-stream');
const errorHandle = require('errorhandler');
const http = require('http');
const https = require('https');
const helpers = require('view-helpers');
const consolidate = require('consolidate');
const morgan = require('morgan');
const compression = require('compression');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoStore = require('connect-mongo')(session);
const flash = require('connect-flash');
const expressValidator = require('express-validator');
const assetmanager = require('assetmanager');
const passport = require('passport');

function ExpressEngine() {
    Engine.call(this);
    this.app = null;
    this.database = null;
    this.nodejscore = null;
}

ExpressEngine.prototype = Object.create(Engine, {
    'constructor': {
        value: ExpressEngine,
        configurable: false,
        writable: false,
        enumerable: false
    }
});

ExpressEngine.prototype.destroy = function () {
    this.app = null;
    this.database = null;
    this.nodejscore = null;
    Engine.prototype.destroy.call(this);
};

ExpressEngine.prototype.getEngineName = function () {
    return 'express';
};

ExpressEngine.prototype.initApp = function () {
    var config = this.nodejscore.config.clean;

    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({
        extended: true
    }));
    this.app.use(expressValidator());
    this.app.use(methodOverride());

    // Express/Mongo session storage
    this.app.use(session({
        secret: config.sessionSecret,
        store: new mongoStore({
            db: this.database.connection.db,
            collection: config.sessionCollection
        }),
        cookie: config.sessionCookie,
        name: config.sessionName,
        resave: true,
        saveUninitialized: true
    }));

    this.app.use(passport.initialize());
    this.app.use(passport.session());
    this.nodejscore.register('passport', passport);

    require(process.cwd() + '/config/express')(this.app, this.database);

    return this.app;
};

ExpressEngine.prototype.beginBootstrap = function (nodejscoreInstance, database) {
    this.nodejscore = nodejscoreInstance;
    this.database = database.connection;

    var config = nodejscoreInstance.config.clean,
        app = express(),
        gfs;

    app.useStatic = function (stName, stPath) {
        if (typeof stPath === 'undefined') {
            this.use(express.static(stName));
        } else {
            this.use(stName, express.static(stPath));
        }
    };

    this.app = app;
    nodejscoreInstance.register('app', this.initApp.bind(this));
    gfs = new Grid(this.database.connection.db, this.database.mongo);

    function themeHandler(req, res) {
        res.setHeader('content-type', 'text/css');

        gfs.files.findOne({
            filename: 'theme.css'
        }, function(err, file) {

            if (!file) {
                fs.createReadStream(appPath + '/bower_components/bootstrap/dist/css/bootstrap.css').pipe(res);
            } else {
                var readstream = gfs.createReadStream({
                    filename: 'theme.css'
                });

                readstream.on('error', function(err) {
                    console.log('An error occurred!', err.message);
                    throw err;
                });

                readstream.pipe(res);
            }
        });
    }

    app.get('/bower_components/bootstrap/dist/css/bootstrap.css', themeHandler);

    var httpServer = http.createServer(app);

    nodejscoreInstance.register('http', httpServer);
    httpServer.listen(config.http ? config.http.port : config.port, config.hostname);

    if (config.https && config.https.port) {
        var httpsOptions = {
            key: fs.readFileSync(config.https.ssl.key),
            cert: fs.readFileSync(config.https.ssl.cert)
        };
        var httpsServer = https.createServer(httpsOptions, app);

        nodejscoreInstance.register('https', httpsServer);
        httpsServer.listen(config.https.port);
    }

    nodejscoreInstance.name = config.app.name;
    nodejscoreInstance.app = app;
    nodejscoreInstance.menus = new nodejscoreInstance.Menus();
};

ExpressEngine.prototype.endBootstrap = function (callback) {
    var app = this.app;

    app.route('*').get(finalRouteHandler.bind(this));

    app.use(function (err, req, res, next) {
        if (err && err.message.indexOf('not found') > -1) {
            return next();
        }

        console.log(err.stack);

        res.status(500).render('500', {
            error: err.stack
        });
    });

    app.use(function (req, res) {
        res.status(404).render('404', {
            url: req.originalUrl,
            error: 'Not Found'
        });
    });

    if (process.env.NODE_ENV === 'development') {
        app.use(errorHandle());
    }

    callback(this);
};

function finalRouteHandler(req, res, next) {
    if (!this.template) {
        return next();
    }

    this.template(req, res, next);
}

module.exports = ExpressEngine;
