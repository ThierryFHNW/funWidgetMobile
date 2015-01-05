// configuration of the available components (under components)
define('config', function () {
    return {
        workspaces: {
            initial: "projectselect",
            available: [
                'sprintselect',
                'sprintplanning2'
            ]
        }
    }
});

// application starts here
require(['config', 'core-loader', 'core-routing'], function (config, loader, router) {

    // Map k: url path, v: workspaceConfig
    var urlPathToWorkspaceConfig = Object.create(null);
    var numberOfWorkspaceConfigs = config.workspaces.available.length + 1;
    var numberOfWorkspaceConfigsLoaded = 0;

    var initialWorkspaceConfigLoader = loader.createWorkspaceConfigLoader();
    initialWorkspaceConfigLoader.load(config.workspaces.initial, function (wConfig) {
        console.log('*** loaded initial workspaceConfig ' + config.workspaces.initial);
        urlPathToWorkspaceConfig[wConfig.path] = wConfig;
        onConfigLoaded();
        wConfig.show();
    });

    config.workspaces.available.forEach(function (wConfigName) {
        var wcLoader = loader.createWorkspaceConfigLoader();
        wcLoader.load(wConfigName, function (wConfig) {
            console.log('*** loaded workspaceConfig ' + wConfigName);
            urlPathToWorkspaceConfig[wConfig.path] = wConfig;
            onConfigLoaded();
        });
    });

    function onConfigLoaded() {
        numberOfWorkspaceConfigsLoaded += 1;
        if (numberOfWorkspaceConfigs == numberOfWorkspaceConfigsLoaded) {
            // enable url path workspace resolution
            router.enable(urlPathToWorkspaceConfig);
        }
    }

});

require.config({
    paths: {
        'heir': 'bower_components/heir/heir',
        'eventEmitter': 'bower_components/eventEmitter/EventEmitter'
    }
});


window.addEventListener('load', function () {
    //console.log('loaded document from app.js');
});


