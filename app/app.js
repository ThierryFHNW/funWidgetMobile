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
require(['config'], function (config) {

    config.workspaces.available.forEach(function(cfgName) {
        //var wsConfig = new WorkspaceConfig(cfgName);
    });
});


window.addEventListener('load', function () {
    //console.log('loaded document from app.js');
});


