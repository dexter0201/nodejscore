'use strict';

angular.element(document).ready(function () {
    // Init the app
    angular.bootstrap(document, ['nodejscore']);
});

function processModules(modules) {
    var packageModules = [
        'ngCookies',
        'ngResource',
        'ui.bootstrap',
        'ui.router'
    ];

    for (var index in modules) {
        var module = modules[index],
            moduleName = 'nodejscore.' + module.name;

        angular.module(moduleName, module.angularDependencies || []);
        packageModules.push(moduleName);
    }

    angular.module('nodejscore', packageModules);
}

$.ajax('/_getModules', {
    dataType: 'json',
    async: false,
    success: processModules
});