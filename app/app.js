// configuration of the available components (under components)
define('config', function () {
    return {
        src: 'components',
        configFile: 'component.json',
        components: [
            'sprintplanning2-workspace'
        ]
    }
});

// application starts here
require(['config', 'core-loader'], function (config, loader) {

    // load configured components
    config.components.forEach(function (component) {
        loader.load(component, document.body);
    });
});


window.addEventListener('load', function () {
    //console.log('loaded document from app.js');
});


