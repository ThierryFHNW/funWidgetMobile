var $app = angular.module('fun-app', ['ngRoute', function() {
    console.log("starting up angular");
}]);

$app.config(function($routeProvider) {
    $routeProvider
        .when('/home', {
            templateUrl: 'partials/home.html',
            controller: 'HomeCtrl'
        })
        .when('/cordova', {
            templateUrl: 'partials/cordova.html',
            controller: 'HomeCtrl'
        })
        .when('/upload/:source', {
            templateUrl: 'partials/upload.html',
            controller: 'UploadCtrl'
        })
        .when('/edit', {
            templateUrl: 'partials/edit.html',
            controller: 'EditCtrl'
        })
        .when('/settings', {
            templateUrl: 'partials/settings.html',
            controller: 'SettingsCtrl'
        })
        .otherwise({redirectTo: '/home'});
});