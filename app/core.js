/**
 * Contains all core functions for the application.
 * @type {{object}}
 */
var app = {};

// Make the app globally accessible for Polymer as mixin
window.appMixin = app;

/**
 * Utility functions.
 * Accessible through app.util
 */
(function (scope) {

    /**
     * Check if a given variable is not a function.
     *
     * @param func The variable to check.
     * @returns {boolean} true if the variable is not a function.
     */
    function isNotFunction(func) {
        return !isFunction(func);
    }

    /**
     * Check if the given variable is a function.
     *
     * @param func The variable to check.
     * @returns {boolean} true if the variable is a function.
     */
    function isFunction(func) {
        return typeof func === 'function';
    }

    /**
     * Clone an object.
     *
     * @param obj The object to clone.
     */
    function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Merge an object. Set the missing attributes in the target object using the ones in the source object.
     *
     * @param target The target to merge the source attributes into.
     * @param source The source object.
     * @returns {*} The merged object.
     */
    function mergeObject(target, source) {
        if (target === undefined) {
            target = cloneObject(source);
        } else {
            for (var option in source) {
                if (!(option in target)) {
                    target[option] = source[option];
                }
            }
        }
        return target;
    }

    // exports

    scope.util = {
        isNotFunction: isNotFunction,
        isFunction: isFunction,
        cloneObject: cloneObject,
        mergeObject: mergeObject
    };

    /**
     * Import the utility-functions directly into the given context (this reference).
     *
     * @param thisRef The this reference in which the util functions of this module should be directly available.
     */
    scope.importUtils = function (thisRef) {
        mergeObject(thisRef, scope.util);
    };

})(app);

/**
 * The core of the application.
 * Accessible through app.core
 */
(function (scope) {

    // import utility functions
    scope.importUtils(this);

    /**
     * Represents a workspace.
     *
     * @param id The unique ID of the workspace.
     * @param config The configuration object.
     * @constructor
     */
    function Workspace(id, config) {
        this.id = id;
        this.config = config;

        // properties derived from the config
        Object.defineProperties(this, {
            'name': {
                value: this.config.name,
                writable: false
            },
            'description': {
                value: this.config.description,
                writable: false
            }
        });

        this.layout = undefined;
        this.widgets = [];

        // path and URL-matcher
        this.matcher = routeMatcher(this.config.path);

        // defined as property so direct access from polymer is possible
        Object.defineProperty(this, 'parsedPath', {
            get: function () {
                return '#' + this.matcher.stringify(routeParams);
            }
        });
    }


    /**
     * Represents a layout.
     *
     * @param id The id of the layout. Represents part of the URL.
     * @constructor
     */
    function Layout(id) {
        this.id = id;
        this.document = {};
    }

    /**
     * Represents a widget.
     *
     * @param id The id of the widget. Represents part of the URL.
     * @param name The name of the widget.
     * @param description The description of the widget.
     * @constructor
     */
    function Widget(id, name, description) {
        this.id = id;
        this.name = name || "";
        this.description = description || "";
        this.document = {};
        this.view = undefined;
        this.position = undefined;
        this.hidden = false;
        this.width = 1;
    }

    /**
     * Loads the dependencies of the workspace (layout and widgets).
     *
     * @param onLoadedCallback Called once all dependencies have been loaded.
     */
    Workspace.prototype.load = function (onLoadedCallback) {
        var layoutLoaded = false;
        var widgetsLoaded = false;

        var onLoaded = function () {
            if (layoutLoaded && widgetsLoaded) {
                onLoadedCallback();
            }
        };

        this.loadLayout(function () {
            layoutLoaded = true;
            onLoaded();
        });

        this.loadWidgets(function () {
            widgetsLoaded = true;
            onLoaded();
        });

    };

    /**
     * Loads all the widgets of this workspace.
     *
     * @param onLoadedCallback Called once all widgets have been loaded.
     */
    Workspace.prototype.loadWidgets = function (onLoadedCallback) {
        if (this.widgets.length > 0) {
            console.log('Widgets for workspace ' + this.name + ' already loaded.');
            onLoadedCallback();
        } else {
            var numberOfWidgets = Object.keys(this.config.widgets).length;
            var numberOfWidgetsLoaded = 0;

            var widgetLoadedCallback = function (widget) {
                // set properties from workspace config
                var widgetConfig = this.config.widgets[widget.id];
                widget.position = widgetConfig.position;
                widget.width = widgetConfig.width;
                widget.hidden = widgetConfig.hidden;

                this.widgets.push(widget);

                numberOfWidgetsLoaded += 1;
                if (numberOfWidgets === numberOfWidgetsLoaded) {
                    onLoadedCallback();
                }
            };

            for (var widgetId in this.config.widgets) {
                console.log('Loading widget ' + widgetId);
                _loadWidget(widgetId, widgetLoadedCallback.bind(this));
            }
        }

    };

    /**
     * Loads the layout of the workspace.
     *
     * @param onLoadedCallback Called once the layout has been loaded.
     */
    Workspace.prototype.loadLayout = function (onLoadedCallback) {
        if (this.layout !== undefined) {
            console.log('Layout for workspace ' + this.name + ' already loaded.');
            onLoadedCallback();
        } else {
            _loadLayout(this.config.layout, function (layout) {
                this.layout = layout;
                if (isFunction(onLoadedCallback)) {
                    onLoadedCallback();
                }
            }.bind(this));
        }
    };

    /**
     * Shows the workspace. Loads the workspace and populates the layout.
     */
    Workspace.prototype.show = function () {
        this.load(function () {
            var workspaceId = 'workspace';
            var rootNode = this.build();
            rootNode.setAttribute('id', workspaceId);

            // remove current active workspace
            var activeRootNode = document.getElementById(workspaceId);
            if (activeRootNode !== null) {
                document.body.removeChild(activeRootNode);
            }

            document.body.appendChild(rootNode);
        }.bind(this));
    };

    /**
     * Builds the workspace. Combines the layout with all the widgets.
     *
     * @returns {HTMLElement} The root node of the workspace.
     */
    Workspace.prototype.build = function () {
        var workspaceLayout = document.createElement('layout-' + this.layout.id);
        this.layout.document = workspaceLayout;
        this.widgets.forEach(function (widget) {
            var templates = widget.document.querySelectorAll('template.content');
            if (templates.length !== 1) {
                console.error('No or more templates found in the widget ' + widget.id + '. Exactly one is needed.');
                return;
            }
            widget.view = document.importNode(templates[0].content, true);
            workspaceLayout.addWidget(widget);
        }, this);
        return workspaceLayout;
    };

    /**
     * Parses the location.hash and returns the parameters as an object if it matches the path of the workspace.
     *
     * @returns {Object} containing the variables of the path as key and the value of the variables as value
     *      or null of the location.hash does no match the path.
     */
    Workspace.prototype.getPathParameters = function () {
        var locationHash = location.hash;
        if (locationHash.indexOf('#') === 0) {
            locationHash = locationHash.substring(1);
        }
        return this.matcher.parse(locationHash);
    };


    /**
     * Simple cache class to hold other objects.
     *
     * @constructor
     */
    function Cache() {
        this.objects = {};
    }

    /**
     * Add an object to the cache.
     *
     * @param objectId The id to store the object under.
     * @param object The actual object to cache.
     */
    Cache.prototype.add = function (objectId, object) {
        this.objects[objectId] = object;
    };

    /**
     * Checks if the cache contains an object under the given id.
     *
     * @param objectId The id to check.
     * @returns {boolean} true, if the cache contains the object, false otherwise.
     */
    Cache.prototype.contains = function (objectId) {
        return this.objects.hasOwnProperty(objectId);
    };

    /**
     * Retrieves the object under the given key.
     *
     * @param objectId The id of the obejct to retrieve.
     * @returns {*} The object saved under the given id or null.
     */
    Cache.prototype.get = function (objectId) {
        return this.objects.hasOwnProperty(objectId) ? this.objects[objectId] : null;
    };

    /**
     * Removes an object saved under the given id.
     *
     * @param objectId The id of the object to remove.
     */
    Cache.prototype.remove = function (objectId) {
        delete this.objects[objectId];
    };

    /**
     * Removes all objects stored in the cache.
     */
    Cache.prototype.clear = function () {
        this.objects = {};
    };

    /**
     * Get all the keys of all pairs in the cache.
     *
     * @returns {Array} With all the keys.
     */
    Cache.prototype.keys = function () {
        return Object.keys(this.objects);
    };

    /**
     * Get all the cached values.
     *
     * @returns {Array} With all values.
     */
    Cache.prototype.values = function () {
        return this.keys().map(function (key) {
            return this.objects[key];
        }, this);
    };


    /**
     * Cache of loaded resources.
     * @type {Cache}
     */
    var resourceCache = new Cache();


    /**
     * Represents data that is loaded from a server that can be cached.
     *
     * @param url The URL of the resource.
     * @constructor
     */
    function Resource(url) {
        this.url = url;
        this.data = undefined;
    }

    heir.inherit(Resource, EventEmitter, true);

    Resource.prototype.isLoaded = function () {
        return this.data !== undefined;
    };


    /**
     * Loads a JSON file.
     *
     * @param url The URL of the JSON file to load.
     * @param onSuccessCallback The function called if the request was successful.
     *      The first parameter is the parsed JSON as object.
     * @param onErrorCallback The function called if the request was unsuccessful.
     *      Parameters: HTTP status code, HTTP status text, response body.
     */
    function _loadJson(url, onSuccessCallback, onErrorCallback) {
        if (isNotFunction(onSuccessCallback)) {
            console.error('The supplied success-callback must be a function.');
            return;
        }

        if (resourceCache.contains(url)) {
            var resource = resourceCache.get(url);
            if (resource.isLoaded()) {
                console.log('Resource ' + url + ' is cached.');
                onSuccessCallback(resource.data);
            } else {
                console.log('Resource ' + url + ' is loading.');
                resource.addOnceListener('loaded', function () {
                    onSuccessCallback(resource.data);
                });
            }
        } else {
            console.log('Resource ' + url + ' is new.');
            resourceCache.add(url, new Resource(url));

            // load the JSON file
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {   // DONE
                    if (xhr.status == 200) {  // HTTP OK
                        var data = JSON.parse(xhr.responseText);
                        var resource = resourceCache.get(url);
                        resource.data = data;

                        console.log('Resource ' + url + ' has been loaded');
                        onSuccessCallback(data);
                        // notify the listeners added while the element was loading
                        resource.emitEvent('loaded', data);
                    } else {
                        if (isFunction(onErrorCallback)) {
                            onErrorCallback(xhr.status, xhr.statusText, xhr.responseText);
                        }
                    }
                }
            };
            xhr.send();
        }
    }

    /**
     * Loads a HTML page via HTML Import and adds the link to the header of the document.
     *
     * @param url The URL of the HTML document to load.
     * @param onSuccessCallback Function called after the HTML document has been loaded. Parameters: Event.
     */
    function _loadHtml(url, onSuccessCallback) {
        // Does not need to be optimized with a cache, that is already done by the browser, given that we use a HTML link element..
        var link = document.createElement('link');
        link.rel = 'import';
        link.href = url;
        link.addEventListener('load', onSuccessCallback);
        document.head.appendChild(link);
    }


    /**
     * Loads the widget by id.
     *
     * @param id The id of the widget.
     * @param onLoadedCallback The function called if the widget has been loaded.
     */
    function _loadWidget(id, onLoadedCallback) {
        var widget = new Widget(id);

        var indexHtmlLoaded = false;
        var widgetConfigLoaded = false;

        function onPartLoaded() {
            if (indexHtmlLoaded && widgetConfigLoaded) {
                console.log('Widget ' + widget.id + ' has been loaded');
                onLoadedCallback(widget);
            }
        }

        // load index.html of widget
        var htmlUrl = 'widgets/' + widget.id + '/index.html';
        _loadHtml(htmlUrl, function (e) {
            indexHtmlLoaded = true;

            widget.document = e.target.import;
            onPartLoaded();
        });

        // load config
        var configUrl = 'widgets/' + id + '/widget.json';
        _loadJson(configUrl, function (config) {
            widgetConfigLoaded = true;

            widget.name = config.name || "";
            widget.description = config.description || "";

            onPartLoaded();
        });

    }

    /**
     * Loads a layout by id.
     *
     * @param id The id of the layout.
     * @param onLoadedCallback The function called if the layout has been loaded.
     */
    function _loadLayout(id, onLoadedCallback) {
        var url = 'layouts/' + id + '.html';
        _loadHtml(url, function () {
            onLoadedCallback(new Layout(id));
        });
    }


    /**
     * Loads a workspace configuration by ID.
     * @param id The unique ID of the workspace (name of the JSON-file without .json)
     * @param onSuccessCallback Called once the config has been loaded. The loaded config is supplied as first parameter to this function.
     */
    function _loadConfig(id, onSuccessCallback) {
        var configUrl = 'workspaces/' + id + '.json';
        _loadJson(configUrl, function (loadedConfig) {
            if (isValidWorkspaceConfig(loadedConfig)) {
                if (isNotFunction(onSuccessCallback)) {
                    console.error('Supplied callback is not a function.');
                    return;
                }
                onSuccessCallback(loadedConfig);
            }
        });
    }

    /**
     * Verifies the workspace config.
     *
     * @param config The workspace config to check.
     * @returns {boolean} true if the config is valid, false otherwiese.
     */
    function isValidWorkspaceConfig(config) {
        var valid = true;
        var requiredProperties = [
            'name',
            'path',
            'layout',
            'widgets'
        ];
        requiredProperties.forEach(function (property) {
            if (!config.hasOwnProperty(property)) {
                console.error('Error, the workspace config has no ' + property + ' property!');
                valid = false;
            }
        });
        if (valid) {
            if (Object.keys(config.widgets).length === 0) {
                console.error('At least one widget must be defined in the workspace config for ' + config.name);
            }
            // check if exactly one widget has position = main and all have the required properties
            var numOfMainPositions = 0;
            for (var widgetId in config.widgets) {
                var widgetCfg = config.widgets[widgetId];
                if (!widgetCfg.hasOwnProperty('position')) {
                    valid = false;
                    console.error('Property position is missing in widget-definition ' + widgetId);
                } else {
                    if (widgetCfg.position === 'main') {
                        numOfMainPositions += 1;
                    }
                }
            }
            if (numOfMainPositions === 0) {
                valid = false;
                console.error('No widget is defined with position main in widget-definition ' + widgetId);
            }
            if (numOfMainPositions > 1) {
                valid = false;
                console.error('More than one widget has been defined with position main in widget-definition ' + widgetId);
            }
        }
        return valid;
    }


    /**
     * Creates a config from an loaded workspace.
     *
     * @param workspace The workspace to generate the config from.
     * @returns {*} Config object.
     */
    function workspaceToConfig(workspace) {
        // copy current active config from workspace
        var config = cloneObject(workspace.config);

        /*
         * Reflect the positional and visibility changes.
         * (only a fully loaded workspace has widgets populated)
         */
        if (workspace.widgets.length > 0) {
            workspace.widgets.forEach(function (widget) {
                config.widgets[widget.id] = {
                    position: widget.position,
                    width: widget.width,
                    hidden: widget.hidden
                };
            });
        }

        return config;
    }

    /**
     * Load a workspace by ID either from local storage if saved or from the server.
     *
     * @param id The ID of the workspace to load.
     * @param onSuccessCallback (optional) Called once the workspace has been loaded.
     */
    function loadWorkspace(id, onSuccessCallback) {

        var onLoaded = function (id, config) {
            var workspace = new Workspace(id, config);
            workspaces.add(id, workspace);
            routeChanged();
            if (isFunction(onSuccessCallback)) {
                onSuccessCallback(workspace);
            }
        };

        if (workspaces.contains(id)) {
            console.log('Workspace ' + id + ' already loaded.');
            if (isFunction(onSuccessCallback)) {
                onSuccessCallback(workspaces.get(id));
            }
        } else {
            var loadedConfig = JSON.parse(window.localStorage.getItem('workspace_' + id));
            if (loadedConfig !== null) {
                console.log('Load workspace ' + id + ' from local storage.');
                if (isValidWorkspaceConfig(loadedConfig)) {
                    onLoaded(id, loadedConfig);
                }
            } else {
                console.log('Load workspace ' + id + ' from server.');
                _loadConfig(id, function (config) {
                    onLoaded(id, config);
                });
            }
        }
    }

    /**
     * Save the workspace config in local storage.
     *
     * @param workspace The workspace whose config should be saved.
     */
    function saveWorkspace(workspace) {
        var workspaceConfig = workspaceToConfig(workspace);
        var stringConfig = JSON.stringify(workspaceConfig);
        window.localStorage.setItem('workspace_' + workspace.id, stringConfig);
    }

    /**
     * Reset the workspace and reload its config.
     *
     * @param workspace The workspace whose config should be reloaded from the server.
     */
    function resetWorkspace(workspace) {
        window.localStorage.removeItem('workspace_' + workspace.id);
        // remove from loaded workspaces
        workspaces.remove(workspace.id);
        // load again (should be from the server now)
        loadWorkspace(workspace.id);
    }

    /**
     * Check whether the given workspace's config is saved in local storage.
     *
     * @param workspace The workspace
     * @returns {boolean} true, if save in local storage, false otherwise.
     */
    function isWorkspaceInLocalStorage(workspace) {
        return window.localStorage.getItem('workspace_' + workspace.id) !== null;
    }


    /**
     * Callback function.
     * To be called when the fragment identifier (hashchange) has been changed.
     */
    function routeChanged() {
        workspaces.values().some(function (workspace) {
            var newParams = workspace.getPathParameters();
            if (newParams !== null) {
                routeParams = newParams;
                if (activeWorkspace !== workspace) {
                    activeWorkspace = workspace;
                    activeWorkspace.show();
                }
                return true;
            }
        });
    }

    // Object with the path-variable (e.g. projectId) as key and the actual value as value.
    var routeParams = {};

    // List of loaded workspaces.
    var workspaces = new Cache();

    // The currently displayed workspace.
    var activeWorkspace = null;

    // Add global #-change listener
    window.addEventListener('hashchange', routeChanged);


    // exports

    scope.core = {
        loadWorkspace: loadWorkspace,
        /**
         * Save the currently active workspace.
         * @returns {boolean} indicates whether the to active workspace is in local storage.
         */
        saveActiveWorkspace: function () {
            saveWorkspace(activeWorkspace);
            return isWorkspaceInLocalStorage(activeWorkspace);
        },
        /**
         * Reset the saved configuration of the currently active workspace.
         * @returns {boolean} indicates whether the to active workspace is in local storage.
         */
        resetActiveWorkspace: function () {
            resetWorkspace(activeWorkspace);
            return isWorkspaceInLocalStorage(activeWorkspace);
        },
        /**
         * Check if the active workspace has its config saved in local storage.
         * @returns {boolean} true if in local storage, false otherwise.
         */
        isWorkspaceSaved: function () {
            return isWorkspaceInLocalStorage(activeWorkspace);
        },
        get routeParams() {
            return routeParams;
        },
        get workspaces() {
            return workspaces.values().filter(function (space) {
                // Real workspaces more than one widget, otherwise it's a single-page widget
                return Object.keys(space.config.widgets).length > 1;
            });
        },
        get activeWorkspace() {
            return activeWorkspace;
        }
    };

})(app);


/**
 * Functions to create draggables, dropzones and resizeable elements.
 * Accessible through app.touch
 */
(function (scope) {

    // import utility functions
    scope.importUtils(this);

    function draggableEnableSnapping(element, revertToStart) {
        // snap to dropzone
        interact(element).draggable({
            snap: {
                mode: 'anchor',
                targets: [],
                range: Infinity,
                relativePoints: [{x: 0, y: 0}],
                endOnly: true
            }
        });
        // revert back to starting point if not dropped in another drop zone
        if (revertToStart) {
            interact(element).on('dragstart', function (event) {
                var rect = interact.getElementRect(event.target);

                // record center point when starting a drag
                event.interactable.startPos = {
                    x: rect.left,
                    y: rect.top
                };
                // snap to the start position
                event.interactable.draggable({
                    snap: {
                        targets: [event.interactable.startPos]
                    }
                });
            });
        }
    }

    function dropZoneEnableSnapping(element) {
        interact(element).on('dragenter', function (event) {
            // enable snap
            var dropRect = interact.getElementRect(event.target),
                dropCenter = {
                    x: dropRect.left,
                    y: dropRect.top
                };

            event.draggable.draggable({
                snap: {
                    targets: [dropCenter]
                }
            });
        });
        interact(element).on('dragleave', function (event) {
            // snap to the start position
            event.draggable.draggable({
                snap: {
                    targets: [event.draggable.startPos]
                }
            });
        });
    }

    /**
     * Makes an element a drop-zone for a draggable.
     * @param element The element to make a drop zone.
     * @param options Options to configure the dropzone:
     *      Available options:
     *          accept: The CSS selector that is accepted by this dropzone.
     *          ondrop: Function called when a draggable is dropped.
     *          onenter: Function called when a draggable enters the dropzone so it can be dropped.
     *          onleave: Function called when a draggable leaves the dropzone so it cannot be dropped anymore.
     */
    function makeDropzone(element, options) {
        options = mergeObject(options, {
            accept: '',
            data: {},
            ondrop: function () {
            },
            onenter: function () {
            },
            onleave: function () {
            }
        });

        interact(element).dropzone({
            // only accept elements matching this CSS selector
            accept: options.accept,

            // listen for drop related events:
            ondropactivate: function (event) {
                event.interaction.dropped = false;
                // add active dropzone feedback
                event.target.classList.add('drop-active');
            },
            ondragenter: function (event) {
                var draggableElement = event.relatedTarget,
                    dropzoneElement = event.target;

                // feedback the possibility of a drop
                dropzoneElement.classList.add('drop-entered');
                draggableElement.classList.add('can-drop');

                options.onenter({
                    data: options.data,
                    draggableElement: draggableElement
                });
            },
            ondragleave: function (event) {
                // remove the drop feedback style
                event.target.classList.remove('drop-entered');
                event.relatedTarget.classList.remove('can-drop');

                options.onleave({
                    data: options.data,
                    draggableElement: event.relatedTarget
                });
            },
            ondrop: function (event) {
                event.interaction.dropped = true;

                // reset z-index to the default value
                event.relatedTarget.style.zIndex = '';

                // call the callback with the data of the interaction set by the draggable in onstart.
                options.ondrop({
                    draggableData: event.interaction.data,
                    draggableElement: event.relatedTarget
                });

                // call ondrop of the draggable
                var draggable = event.draggable;
                if (isFunction(draggable.ondrop)) {
                    draggable.ondrop(event);
                }
            },
            ondropdeactivate: function (event) {
                // remove active dropzone feedback
                event.target.classList.remove('drop-active');
                event.target.classList.remove('drop-entered');
                event.relatedTarget.classList.remove('can-drop');

                // reduce z-index to stay on top
                var draggableStyle = event.relatedTarget.style;
                if (draggableStyle.zIndex !== '') {
                    draggableStyle.zIndex = '50';
                }
            }
        });

        dropZoneEnableSnapping(element);
    }

    /**
     * Makes an element a draggable.
     * @param element The element to make draggable.
     * @param options Options to configure the draggable.
     *      Available options:
     *          clone: boolean  // clones the draggable element and appends it to document.body.
     *          absolute: boolean // the draggable is handled with absolute units to the viewport independent of the dropzone.
     *          data: object // the data to attach to the interaction. Will be available to the dropzone in ondrop.
     *          revert: boolean // whether to revert back to the start position when not dropped in dropzone.
     *          onstart: function called on start of dragging.
     *          onmove: function called when the element is moved.
     *          onend: function called on end of dragging.
     *
     */
    function makeDraggable(element, options) {
        options = mergeObject(options, {
            clone: false,
            data: null,
            revert: true,
            absolute: false,
            onstart: function () {
            },
            onmove: function () {
            },
            onend: function () {
            },
            ondrop: function () {
            }
        });

        // encapsulate the ondrop function to execute other code
        var onDropOptions = options.ondrop;
        options.ondrop = function (e) {
            var target = e.relatedTarget;
            if (options.absolute) {
                target.style.position = 'relative';
                target.style.left = '';
                target.style.top = '';
            } else {
                target.style.webkitTransform =
                    target.style.transform = '';
            }

            // execute original ondrop function
            onDropOptions(e);
        };

        interact(element).draggable({
            // call this function on every dragmove event
            onmove: function (event) {
                var target = this.target,
                // keep the dragged position in the data-x/data-y attributes
                    x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                    y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                // translate the element
                if (options.absolute) {
                    //var style = this.target.style;
                    this.target.style.left = x + 'px';
                    this.target.style.top = y + 'px';
                } else {
                    target.style.webkitTransform =
                        target.style.transform =
                            'translate(' + x + 'px, ' + y + 'px)';
                }
                // update the position attributes
                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);

                options.onmove(event);
            },
            onend: function (event) {
                this.target.classList.remove('dragging');

                // remove clone
                if (this.target !== event.target) {
                    document.body.removeChild(this.target);
                }

                options.onend(event);
            },
            onstart: function (event) {
                // attach data to the interaction
                event.interaction.data = options.data;

                // attach ondrop callback
                event.interactable.ondrop = options.ondrop;

                // clone if set in options
                if (options.clone) {
                    this.target = event.target.cloneNode(true);
                    applyStyle(event.target, this.target);
                    document.body.appendChild(this.target);
                } else {
                    this.target = event.target;
                }


                if (options.clone) {
                    // set absolute position to pointer
                    var offsets = event.interaction.snapOffsets[0];
                    this.target.style.position = 'absolute';
                    this.target.style.left = (event.clientX - offsets.x) + 'px';
                    this.target.style.top = (event.clientY - offsets.y) + 'px';
                }

                if (options.absolute) {
                    var compStyle = getComputedStyle(this.target, null);
                    this.target.style.width = compStyle.width;
                    this.target.style.height = compStyle.height;

                    // set absolute position to pointer
                    this.target.style.position = 'fixed';
                    var rect = this.target.getBoundingClientRect();
                    this.target.style.top = rect.top;
                    this.target.style.left = rect.left;

                    // set the absolute position as attributes
                    this.target.setAttribute('data-x', rect.left);
                    this.target.setAttribute('data-y', rect.top);
                }

                // make sure the draggable is always over the other elements
                this.target.style.zIndex = '100';
                this.target.classList.add('dragging');

                options.onstart(event);
            }
        });

        draggableEnableSnapping(element, options.revert);
    }


    // copy style definitions recursively
    function applyStyle(source, target) {
        target.style.cssText = window.getComputedStyle(source, null).cssText;
        if (target.childElementCount > 0) {
            for (var i = 0; i < source.childElementCount; i++) {
                applyStyle(source.children[i], target.children[i]);
            }
        }
    }

    /**
     * reset the postion of the element.
     * @param target The element to reposition
     */
    function resetPosition(target) {
        // translate the element
        target.style.webkitTransform =
            target.style.transform =
                'translate(' + 0 + 'px, ' + 0 + 'px)';

        target.style.position = '';
        target.style.top = '';
        target.style.left = '';

        // update the position attributes
        target.setAttribute('data-x', 0);
        target.setAttribute('data-y', 0);
    }

    /**
     * Makes an element resizable via mouse or via pinch-to-zoom.
     * @param element The element to make resizable.
     * @param options Options to configure the resizable:
     *      Available options:
     *          onstart: function called on start of resizing.
     *          onmove: function called when the element is moved.
     *          onend: function called on end of resizing.
     *          disableMove: function to control the move function of the resizable: return true to disable resizing temporarily.
     */
    function makeResizable(element, options) {

        options = mergeObject(options, {
            onstart: function () {
            },
            onmove: function () {
            },
            onstop: function () {
            },
            disableMove: function () {
                return false;
            }
        });

        function onstart(target) {
            // save the initial size
            if (target.initialSize === undefined) {
                target.initialSize = interact.getElementRect(target);
            }
        }

        function onmove(target, dx, dy) {
            var currentSize = interact.getElementRect(target);

            // add the change in coords to the previous width of the target element
            var newWidth = parseFloat(currentSize.width) + dx,
                newHeight = parseFloat(currentSize.height) + dy;

            // update the element's style only if it's not smaller that the initial size
            if (newHeight >= target.initialSize.height) {
                target.style.height = newHeight + 'px';
            }
            if (newWidth >= target.initialSize.width) {
                target.style.width = newWidth + 'px';
            }
        }

        // resize
        interact(element)
            .resizable({
                edges: {
                    top: false,
                    left: false,
                    bottom: '.resize',
                    right: '.resize'
                }
            })
            .on('resizestart', function (event) {
                onstart(event.target);
                options.onstart(event);
            })
            .on('resizemove', function (event) {
                if (!options.disableMove()) {
                    onmove(event.target, event.dx, event.dy);
                }
                options.onmove(event);
            })
            .on('resizeend', function (event) {
                options.onend(event);
            });

        // pinch-to-zoom
        interact(element).gesturable({
            onstart: function (event) {
                onstart(event.target);
                event.interaction.initialDistance = event.distance;
                options.onstart(event);
            },
            onmove: function (event) {
                if (!options.disableMove()) {
                    var target = event.target;
                    var previousDistance = event.interaction.previousDistance || event.interaction.initialDistance;
                    var distanceDiff = event.distance - previousDistance;
                    onmove(target, distanceDiff, distanceDiff);
                    event.interaction.previousDistance = event.distance;
                }
                options.onmove(event);
            },
            onend: function (event) {
                options.onend(event);
            }
        });
    }

    /**
     * Enable double-tap on the given element.
     *
     * @param element The element to enable double-tap on.
     * @param callback The function called when double-tapped.
     */
    function onDoubletap(element, callback) {
        interact(element).on('doubletap', callback);
    }

    /**
     * Compares two values with a given deviation.
     *
     * @param a First value.
     * @param b Second value.
     * @param deviation The allowed deviation when comparing the two values.
     * @returns {boolean} true if the fist and second value lie within the given deviation of each other.
     */
    function near(a, b, deviation) {
        for (var distance = 1; distance <= Math.abs(deviation); distance++) {
            if (a + distance == b || a - distance == b) {
                return true;
            }
        }
        return false;
    }

    /**
     * Compare dimensions.
     *
     * @param dimA Object with height and width.
     * @param dimB Object with height and width.
     * @param deviation (optional, defaults to 0) The allowed deviation when comparing the two values.
     * @returns {boolean}
     */
    function compareDimensions(dimA, dimB, deviation) {
        deviation = deviation || 0;

        // exactly
        if (dimA.height == dimB.height && dimA.width == dimB.width) {
            return true;
        } else if (deviation !== 0) {
            // allow a deviation because the values may already be rounded
            return near(dimA.height, dimB.height, deviation) && near(dimA.width, dimB.width, deviation);
        }
        // deviation is 0 and does not match
        return false;
    }


    // exports

    scope.touch = {
        makeDraggable: makeDraggable,
        makeDropzone: makeDropzone,
        makeResizable: makeResizable,
        onDoubletap: onDoubletap,
        resetDraggablePosition: resetPosition,
        compareDimensions: compareDimensions
    };

})(app);
