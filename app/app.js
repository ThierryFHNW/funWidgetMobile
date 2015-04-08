// configuration of the available workspaces
define('config', function () {
    return {
        workspaces: [
            'projectselect',
            'sprintselect',
            'workspaceselect',
            'sprintplanning2',
            'taskboard'
        ]
    };
});

// application starts here
require(['config', 'core-loader', 'core-routing'], function (config, loader, router) {

    // Map k: url path, v: workspace
    var urlPathToWorkspace = {};
    var numberOfWorkspaces = config.workspaces.length;
    var numberOfWorkspacesLoaded = 0;

    config.workspaces.forEach(function (workspaceId) {
        var wcLoader = loader.createWorkspaceLoader();
        wcLoader.load(workspaceId, function (workspace) {
            console.log('*** loaded workspace ' + workspaceId);
            urlPathToWorkspace[workspace.path] = workspace;
            onWorkspacesLoaded();
        });
    });

    function onWorkspacesLoaded() {
        numberOfWorkspacesLoaded += 1;
        if (numberOfWorkspaces == numberOfWorkspacesLoaded) {
            // enable url path workspace resolution
            router.enable(urlPathToWorkspace);
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


