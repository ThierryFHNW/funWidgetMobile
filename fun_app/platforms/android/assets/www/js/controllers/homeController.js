$app.controller('HomeCtrl', ['$scope', '$location', function($scope, $location) {
    $scope.debugMessage = "Hello World";

    $scope.go = function(path) {
        $location.path(path);
    }
}]);