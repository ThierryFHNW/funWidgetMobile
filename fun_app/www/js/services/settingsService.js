
$app.service('settingsService', function() {
    var settings;

    this.getConfigurations = function() {
        return settings.configurations;
    };

    this.getDefaultConfiguration = function() {
        return settings.default;
    };

    this.setDefaultConfiguration = function(id) {
        settings.default = id;
        saveSettings();
    };

    this.add = function(configuration) {
        configuration.id = new Date().getTime();
        settings.configurations[configuration.id] = configuration;
        saveSettings();
    };

    this.edit = function(configuration) {
        var conf = settings.configurations[configuration.id];
        conf.server = configuration.server;
        conf.project = configuration.project;
        conf.user = configuration.user;
        saveSettings();
    };

    this.remove = function(configuration) {
        delete settings.configurations[configuration.id];
        saveSettings();
    };

    var saveSettings = function() {
        window.localStorage.setItem("settings", JSON.stringify(settings));
    };

    var loadSettings = function() {
        settings = JSON.parse(window.localStorage.getItem("settings"));
        if (!settings) {
            settings = {
                configurations: {}
            };
        }
    };

    loadSettings();
});