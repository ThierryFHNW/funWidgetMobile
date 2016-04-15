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

$app.controller('HomeCtrl', function($scope) {
    $scope.debugMessage = "Hello World";
});


$app.controller('UploadCtrl', ['$scope', '$routeParams', function($scope, $routeParams) {
    $scope.source = $routeParams.source;

    var send = function send() {
        alert("Bild hochgeladen \n " + $scope.description);
    };

    var retake = function retake(source) {
        $scope.source = source;
        takePicture();
    }

    $scope.send = send;
    $scope.retake = retake;

    function onCaptureSuccess(imageData) {
        //$scope.imageBase64 = "data:image/jpeg;base64," + imageData;
        $("#picture").attr("src", "data:image/jpeg;base64," + imageData);
        //document.getElementById("picture").src = "data:image/jpeg;base64," + imageData
    }

    function onGallerySuccess(imageURI) {
        document.getElementById("picture").src = imageURI;
    }

    function onFail() {
        alert("didnt work");
    }

    function takePicture() {
        if ($scope.source == 'capture') {
            navigator.camera.getPicture(onCaptureSuccess, onFail, { quality: 50,
                destinationType: Camera.DestinationType.DATA_URL,
                sourceType: Camera.PictureSourceType.CAMERA
            });
        } else if ($scope.source == 'gallery') {
            navigator.camera.getPicture(onGallerySuccess, onFail, { quality: 50,
                destinationType: Camera.DestinationType.FILE_URI,
                sourceType: Camera.PictureSourceType.PHOTOLIBRARY
            });
        }
    }

    //takePicture();
}]);

$app.controller('SettingsCtrl', function($scope) {
    $scope.configurations = [];
    $scope.editing = undefined;
    $scope.new = false;

    //var demoSettings = [
    //    {server: "server1095.cs.technik.fhnw.ch"},
    //    {server: "server1096.cs.technik.fhnw.ch"},
    //    {server: "server1097.cs.technik.fhnw.ch"}
    //];
    //window.localStorage.setItem("settings", JSON.stringify(demoSettings));


    function loadSettings() {
        $scope.configurations = JSON.parse(window.localStorage.getItem("settings"));
        if (!$scope.configurations) {
            $scope.configurations = [];
        }
    }
    function saveSettings() {
        window.localStorage.setItem("settings", JSON.stringify($scope.configurations));
    }

    var add = function add() {
        $scope.editing = {};
        $scope.new = true;
    }
    var edit = function edit(configuration) {
        $scope.editing = configuration;
        $scope.new = false;
    };
    var cancel = function cancel() {
        loadSettings();
        $scope.editing = undefined;
    };
    var save = function save() {
        if ($scope.new) {
            $scope.configurations.push($scope.editing);
        }
        saveSettings();
        $scope.editing = undefined;
    };
    var remove = function remove() {
        $scope.configurations.splice($scope.configurations.indexOf($scope.editing),1);
        saveSettings();
        $scope.editing = undefined;
    };


    loadSettings();
    $scope.edit = edit;
    $scope.cancel = cancel;
    $scope.save = save;
    $scope.add = add;
    $scope.remove = remove;
});
