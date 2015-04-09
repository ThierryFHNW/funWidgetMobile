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

require.config({
    paths: {
        'heir': 'bower_components/heir/heir',
        'eventEmitter': 'bower_components/eventEmitter/EventEmitter'
    }
});
