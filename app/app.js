// configuration of the available components (under components)
define('config', function () {
    return {
        workspaces: {
            initial: "sprintplanning2",
            available: [

            ]
        }
    }
});

// application starts here
require(['config', 'core-loader'], function (config, loader) {

    loader.runTests();

    config.workspaces.available.forEach(function(cfgName) {
        //var wsConfig = new WorkspaceConfig(cfgName);
    });
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


