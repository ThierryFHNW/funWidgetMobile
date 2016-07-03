$app.controller('SettingsCtrl', ['$scope', 'settingsService', function($scope, $settingsService) {
    $scope.servers = [];
    $scope.editing = undefined;
    $scope.new = false;
    $scope.servers = $settingsService.getConfigurations();
    $scope.default = {server: $scope.servers[$settingsService.getDefaultConfiguration()]};
    $scope.message = undefined;

    function loadSettings() {
        $scope.servers = $settingsService.getConfigurations();
        $scope.default.server = $scope.servers[$settingsService.getDefaultConfiguration()];
        //$scope.default = $scope.configurations[1462106325932];
    }

    var add = function add() {
        $scope.message = undefined;
        $scope.editing = {};
        $scope.new = true;
        loadSettings();
    };
    var edit = function edit(configuration) {
        $scope.message = undefined;
        $scope.editing = configuration;
        $scope.new = false;
    };
    var cancel = function cancel() {
        loadSettings();
        $scope.editing = undefined;
    };
    var save = function save() {
        if ($scope.new) {
            $settingsService.add($scope.editing);
            $scope.message = {text: "New Configuration added"};
        } else {
            $settingsService.edit($scope.editing);
            $scope.message = {text: "Changes saved"};
        }
        $scope.editing = undefined;
    };
    var remove = function remove() {
        $settingsService.remove($scope.editing);
        $scope.editing = undefined;
        loadSettings();
        $scope.message = {text: "Configuration removed"};
    };
    var changeDefault = function changeDefault() {
        $settingsService.setDefaultConfiguration($scope.default.server.id);
        $scope.message = {text: "Default Configuration changed"};
    };

    loadSettings();

    $scope.edit = edit;
    $scope.cancel = cancel;
    $scope.save = save;
    $scope.add = add;
    $scope.remove = remove;
    $scope.changeDefault = changeDefault;
}]);