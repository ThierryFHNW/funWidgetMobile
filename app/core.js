var DEBUG = false;
var log = function (msg) {
    if (DEBUG) {
        console.log(msg);
    }
};


/**
 * Loads the workspace configs and the dependent resources.
 */
define('core-loader', ['heir', 'eventEmitter'], function (heir, EventEmitter) {

    /**
     * Represents a workspace.
     *
     * @param id The id of the workspace. Represents part of the URL.
     * @param name The name of the workspace.
     * @param description The description of the workspace.
     * @constructor
     */
    function Workspace(id, name, description) {
        this.id = id;
        this.name = name || "";
        this.description = description || "";
        this.layout = {};
        this.widgets = [];
        this.widgetViewTargets = {};
        this.rootNode = null;
        this.matcher = null;
        this._path = null;
        Object.defineProperty(this, 'path', {
            get: function () {
                return this._path;
            },
            set: function (newPath) {
                this._path = newPath;
                this.matcher = routeMatcher(newPath);
            }
        });

        // defined as property so direct access from polymer is possible
        Object.defineProperty(this, 'parsedPath', {
            get: function () {
                // create app-core element to access the global route parameters.
                var appCoreElement = document.createElement('app-core');
                return '#' + this.matcher.stringify(appCoreElement.routeParams);
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
        this.elements = [];
    }

    /**
     * Represents an element.
     *
     * @param id The id of the element. Represents part of the URL.
     * @constructor
     */
    function Element(id) {
        this.id = id;
    }

    // All resource representations inherit from EventEmitter. Gives them addEventListener and emitEvent.
    heir.inherit(Element, EventEmitter, true);
    heir.inherit(Widget, EventEmitter, true);
    heir.inherit(Layout, EventEmitter, true);
    heir.inherit(Workspace, EventEmitter, true);


    /**
     * Shows the workspace. Builds it if necessary.
     */
    Workspace.prototype.show = function () {
        var WORKSPACE_ID = 'workspace';

        if (this.rootNode === null) {
            this.rootNode = this.build();
            this.rootNode.setAttribute('id', WORKSPACE_ID);
        }

        var activeRootNode = document.getElementById(WORKSPACE_ID);
        if (activeRootNode !== null) {
            document.body.removeChild(activeRootNode);
        }

        document.body.appendChild(this.rootNode);
    };

    /**
     * Builds and loads the workspace.
     *
     * @returns {HTMLElement} The root node of the workspace.
     */
    Workspace.prototype.build = function () {
        var workspaceLayout = document.createElement('workspace-layout-' + this.layout.id);
        this.layout.document = workspaceLayout;
        this.widgets.forEach(function (widget) {
            var templates = widget.document.querySelectorAll('template.content');
            if (templates.length !== 1) {
                console.error('No or more templates found in the widget ' + widget.id + '. Exactly one is needed.');
                return;
            }
            var widgetContent = document.importNode(templates[0].content, true);
            var viewTarget = this.widgetViewTargets[widget.id];
            console.log('Adding widget ' + widget.name + ' to ' + viewTarget + ' in ' + this.id);
            workspaceLayout.addWidget(viewTarget, widgetContent, widget);
        }, this);
        return workspaceLayout;
    };

    /**
     * Parses the location.hash and returns the parameters as an object if it matches the path of the workspace.
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

    // All Loaders inherit from Loader
    heir.inherit(WorkspaceLoader, Loader, true);
    heir.inherit(LayoutLoader, Loader, true);
    heir.inherit(ElementLoader, Loader, true);
    heir.inherit(WidgetLoader, Loader, true);


    /**
     * Base class of all resource loaders.
     * @constructor
     */
    function Loader() {
    }

    /**
     * Cache of loaded resources.
     * @type {Cache}
     */
    Loader.cache = new Cache();

    /**
     * Cache of currently loading resources.
     * @type {Cache}
     */
    Loader.loading = new Cache();

    /**
     * Loads a JSON file.
     *
     * @param url The URL of the JSON file to load.
     * @param onSuccessCallback The function called if the request was successful.
     *      The first parameter is the parsed JSON as object.
     * @param onErrorCallback The function called if the request was unsuccessful.
     *      Parameters: HTTP status code, HTTP status text, response body.
     */
    Loader.prototype.loadJson = function (url, onSuccessCallback, onErrorCallback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {   // DONE
                if (xhr.status == 200) {  // HTTP OK
                    var data = JSON.parse(xhr.responseText);
                    if (typeof onSuccessCallback === 'function') {
                        onSuccessCallback(data);
                    }
                } else {
                    if (typeof onErrorCallback === 'function') {
                        onErrorCallback(xhr.status, xhr.statusText, xhr.responseText);
                    }
                }
            }
        };
        xhr.send();
    };

    /**
     * Loads a HTML page via HTML Import and adds the link to the header of the document.
     *
     * @param url The URL of the HTML document to load.
     * @param onSuccessCallback Function called after the HTML document has been loaded. Parameters: Event.
     */
    Loader.prototype.loadHtml = function (url, onSuccessCallback) {
        var link = document.createElement('link');
        link.rel = 'import';
        link.href = url;
        link.addEventListener('load', onSuccessCallback);
        document.head.appendChild(link);
    };

    /**
     * Generic loader to fetch resources. Handles which resources have been loaded and which are being loaded.
     * So that no resource is loaded more than once.
     *
     * @param url The URL of the resource to fetch.
     * @param emptyObject An instance of the specific Resource.
     * @param onLoadedCallback The function called when the resource has been completely loaded.
     * @param loadActualResource The function to execute if the resource has not been loaded yet or is currently loading.
     *
     */
    Loader.prototype.loadResource = function (url, emptyObject, onLoadedCallback, loadActualResource) {
        if (Loader.cache.contains(url)) {
            log('Resource ' + url + ' is cached.');
            var resource = Loader.cache.get(url);
            onLoadedCallback(resource);
        } else if (Loader.loading.contains(url)) {
            log('Resource ' + url + ' is loading.');
            var loadingResource = Loader.loading.get(url);
            loadingResource.addOnceListener('loaded', function () {
                onLoadedCallback(loadingResource);
            });
        } else {
            log('Resource ' + url + ' is new.');
            Loader.loading.add(url, emptyObject);
            loadActualResource.call(this, url, function () {
                var resource = Loader.loading.get(url);
                Loader.cache.add(url, resource);
                Loader.loading.remove(url);

                log('Resource ' + url + ' has been loaded');
                onLoadedCallback(resource);
                // notify the listeners added while the element was loading
                resource.emitEvent('loaded', resource);
            });
        }
    };


    /**
     * Loader for elements.
     *
     * @constructor
     */
    function ElementLoader() {

    }

    /**
     * Loads an element by id.
     *
     * @param id The id of the element.
     * @param onLoadedCallback The function to be called if the element has been loaded.
     */
    ElementLoader.prototype.load = function (id, onLoadedCallback) {
        var url = 'elements/' + id + '.html';
        Loader.prototype.loadResource(url, new Element(id), onLoadedCallback, this.loadHtml);
    };


    /**
     * Loader for widgets.
     *
     * @constructor
     */
    function WidgetLoader() {

    }

    /**
     * Loads the widget by id.
     *
     * @param id The id of the widget.
     * @param onLoadedCallback The function called if the widget has been loaded.
     */
    WidgetLoader.prototype.load = function (id, onLoadedCallback) {
        var configUrl = 'widgets/' + id + '/widget.json';
        var widget = new Widget(id);
        var config = {};
        var numberOfElements = null;
        var numberOfElementsLoaded = 0;
        var indexHtmlLoaded = false;
        var onResourceLoadedCallback = function () {
        };

        function onDependencyLoaded() {
            if (numberOfElements == numberOfElementsLoaded && indexHtmlLoaded) {
                log('Widget ' + widget.id + ' has been loaded');
                onResourceLoadedCallback();
            }
        }

        function loadElements(elementArray) {
            numberOfElements = elementArray.length;
            log('Widget ' + id + ' has ' + numberOfElements + ' elements');
            elementArray.forEach(function (elementId) {
                var loader = new ElementLoader();
                loader.load(elementId, function (element) {
                    widget.elements.push(element);
                    numberOfElementsLoaded += 1;
                    onDependencyLoaded();
                });
            });
        }

        function loadIndexHtml() {
            var htmlUrl = 'widgets/' + widget.id + '/index.html';
            this.loadHtml(htmlUrl, function (e) {
                console.log('Loaded widget html: ' + e.target.href);
                indexHtmlLoaded = true;
                widget.document = e.target.import;
                onDependencyLoaded();
            });
        }


        function loadWidget(url, onWidgetLoadedCallback) {
            onResourceLoadedCallback = onWidgetLoadedCallback;

            function configLoaded(loadedConfig) {
                config = loadedConfig;

                // set name and description
                widget.name = config.name || "";
                widget.description = config.description || "";

                // load dependencies (elements)
                if (config.hasOwnProperty('elements')) {
                    loadElements(config.elements);
                } else {
                    console.log('Widget ' + id + ' has no elements');
                }

                // load index.html
                loadIndexHtml.call(this);
            }

            this.loadJson(url, configLoaded.bind(this));
        }


        Loader.prototype.loadResource(configUrl, widget, onLoadedCallback, loadWidget);
    };


    /**
     * Loader for layouts.
     *
     * @constructor
     */
    function LayoutLoader() {

    }

    /**
     * Loads a layout by id.
     *
     * @param id The id of the layout.
     * @param onLoadedCallback The function called if the layout has been loaded.
     */
    LayoutLoader.prototype.load = function (id, onLoadedCallback) {
        var url = 'layouts/' + id + '.html';
        Loader.prototype.loadResource(url, new Layout(id), onLoadedCallback, this.loadHtml);
    };


    /**
     * Workspace loader.
     *
     * @constructor
     */
    function WorkspaceLoader() {

    }

    /**
     * Loads workspaces by id.
     *
     * @param id The id of the workspace.
     * @param onLoadedCallback The function called if the workspace has been loaded.
     */
    WorkspaceLoader.prototype.load = function (id, onLoadedCallback) {
        var configUrl = 'workspaces/' + id + '.json';
        var config = {};
        var workspace = new Workspace(id);
        var layoutLoaded = false;
        var numberOfWidgets = null;
        var numberOfWidgetsLoaded = 0;
        var onResourceLoadedCallback = function () {
        };


        function onDependencyLoaded() {
            if (layoutLoaded && numberOfWidgets == numberOfWidgetsLoaded) {
                log('Workspace ' + workspace.id + ' has been loaded');
                onResourceLoadedCallback();
            }
        }

        function loadWidgets() {
            // k: widgetId, v: viewTarget
            var widgetViewTargets = {};
            if (!config.hasOwnProperty('mainWorkspace') || !config.mainWorkspace) {
                console.error(config.name + ' does not have a main workspace!');
                return;
            }

            if (config.hasOwnProperty('widgets') && Object.keys(config.widgets).length > 0) {
                for (var widget in config.widgets) {
                    widgetViewTargets[widget] = config.widgets[widget];
                }
            }

            widgetViewTargets[config.mainWorkspace] = 'mainWorkspace';

            numberOfWidgets = Object.keys(widgetViewTargets).length;
            console.log(config.name + ' has ' + numberOfWidgets + ' widgets');

            var widgetLoadedCallback = function (widget) {
                workspace.widgets.push(widget);
                numberOfWidgetsLoaded += 1;
                onDependencyLoaded();
            };

            workspace.widgetViewTargets = widgetViewTargets;

            for (var widgetId in widgetViewTargets) {
                console.log('Loading widget ' + widgetId);
                var widgetLoader = new WidgetLoader();
                widgetLoader.load(widgetId, widgetLoadedCallback);
            }
        }

        function configLoaded(loadedConfig) {
            config = loadedConfig;

            // set the URL path
            if (!config.hasOwnProperty('path')) {
                console.error('Error, the workspace config has no path attribute!');
                return;
            }
            workspace.path = config.path;

            // set name and description
            workspace.name = config.name || "";
            workspace.description = config.description || "";

            // load layout
            if (!config.hasOwnProperty('layout')) {
                console.error('Loading failed: Workspace has no layout!');
                return;
            }

            var layoutLoadedCallback = function (layout) {
                layoutLoaded = true;
                workspace.layout = layout;
                onDependencyLoaded();
            };
            var layoutLoader = new LayoutLoader();
            layoutLoader.load(config.layout, layoutLoadedCallback);

            // load widgets
            loadWidgets();
        }

        function loadWorkspaceConfig(url, onWorkspaceLoadedCallback) {
            onResourceLoadedCallback = onWorkspaceLoadedCallback;
            this.loadJson(url, configLoaded);
        }


        Loader.prototype.loadResource(configUrl, workspace, onLoadedCallback, loadWorkspaceConfig);
    };


    return {
        /**
         * Creates a workspace loader.
         *
         * @returns {WorkspaceLoader}
         */
        createWorkspaceLoader: function () {
            return new WorkspaceLoader();
        }
    };

});


/**
 * core-touch
 *
 * Provides drag and drop support provided by interact.js.
 */
require(['interact'], function (interact) {
    define('core-touch', function () {

        function _draggableEnableSnapping(element, revertToStart) {
            // snap to dropzone
            interact(element).draggable({
                snap: {
                    mode: 'anchor',
                    targets: [],
                    range: Infinity,
                    relativePoints: [{x: 0.5, y: 0.5}],
                    endOnly: true
                }
            });
            // revert back to starting point if not dropped in another drop zone
            if (revertToStart) {
                interact(element).on('dragstart', function (event) {
                    var rect = interact.getElementRect(event.target);

                    // record center point when starting a drag
                    event.interactable.startPos = {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
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

        function _dropZoneEnableSnapping(element) {
            interact(element).on('dragenter', function (event) {
                // enable snap
                var dropRect = interact.getElementRect(event.target),
                    dropCenter = {
                        x: dropRect.left + dropRect.width / 2,
                        y: dropRect.top + dropRect.height / 2
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
         * @param acceptSelector The CSS selector a draggable must have in order to be accepted by this drop-zone.
         * @param onDropCallback Called when a draggable has been accepted and dropped in this dropzone.
         */
        function _makeDropZone(element, acceptSelector, onDropCallback) {
            interact(element).dropzone({
                // only accept elements matching this CSS selector
                accept: acceptSelector,

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
                },
                ondragleave: function (event) {
                    // remove the drop feedback style
                    event.target.classList.remove('drop-entered');
                    event.relatedTarget.classList.remove('can-drop');
                },
                ondrop: function (event) {
                    event.interaction.dropped = true;

                    if (typeof onDropCallback === 'function') {
                        // call the callback with the data of the interaction set by the draggable in onstart.
                        onDropCallback(event.interaction.data);
                    }
                    // reset z-index to the default value
                    event.relatedTarget.style.zIndex = '';
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

            _dropZoneEnableSnapping(element);
        }

        /**
         * Merge an object. Set the missing options using the defaults in the given default options.
         * @param options The options to merge.
         * @param defaultOptions The default options.
         * @returns {*} The merged object.
         */
        function mergeOptions(options, defaultOptions) {
            if (options === undefined) {
                options = defaultOptions.clone();
            } else {
                for (var option in defaultOptions) {
                    if (!(option in options)) {
                        options[option] = defaultOptions[option];
                    }
                }
            }
            return options;
        }

        /**
         * Makes an element a draggable.
         * @param element The element to make draggable.
         * @param options Options to configure the draggable.
         *      Available options:
         *          clone: boolean  // clones the draggable element and appends it to document.body.
         *          data: object // the data to attach to the interaction. Will be available to the dropzone in ondrop.
         *          revert: boolean // whether to revert back to the start position when not dropped in dropzone.
         *          onstart: function called on start of dragging.
         *          onmove: function called when the element is moved.
         *          onend: function called on end of dragging.
         *
         */
        function _makeDraggable(element, options) {
            options = mergeOptions(options, {
                clone: false,
                data: null,
                revert: true,
                onstart: function () {
                },
                onmove: function () {
                },
                onend: function () {
                }
            });

            interact(element).draggable({
                inertia: {
                    resistance: 30,
                    minSpeed: 200,
                    endSpeed: 100
                },
                // call this function on every dragmove event
                onmove: function (event) {
                    var target = this.target,
                    // keep the dragged position in the data-x/data-y attributes
                        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    // translate the element
                    target.style.webkitTransform =
                        target.style.transform =
                            'translate(' + x + 'px, ' + y + 'px)';

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

                    // clone if set in options
                    if (options.clone) {
                        this.target = event.target.cloneNode(true);
                        // copy style definitions recursively
                        var applyStyle = function (source, target) {
                            target.style.cssText = window.getComputedStyle(source, null).cssText;
                            if (target.childElementCount > 0) {
                                for (var i = 0; i < source.childElementCount; i++) {
                                    applyStyle(source.children[i], target.children[i]);
                                }
                            }
                        };

                        applyStyle(event.target, this.target);

                        // set absolute position to pointer
                        this.target.style.left = event.clientX + 'px';
                        this.target.style.top = event.clientY + 'px';
                        this.target.style.position = 'absolute';
                        document.body.appendChild(this.target);
                    } else {
                        this.target = event.target;
                    }

                    // make sure the draggable is always over the other elements
                    this.target.style.zIndex = '100';
                    this.target.classList.add('dragging');

                    options.onstart(event);
                }
            });

            _draggableEnableSnapping(element, options.revert);
        }

        /**
         * Adds an event listener to the draggable or the drop-zone.
         * See the interact.js documentation for a list of events.
         * @param element The element to register the listener on.
         * @param event The name of the event.
         * @param callback The function that is called on the event.
         */
        function _on(element, event, callback) {
            interact(element).on(event, callback);
        }

        /**
         * reset the postion of the element.
         * @param target The element to reposition
         */
        function _resetPosition(target) {
            // translate the element
            target.style.webkitTransform =
                target.style.transform =
                    'translate(' + 0 + 'px, ' + 0 + 'px)';

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
        function _makeResizable(element, options) {

            options = mergeOptions(options, {
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
                var height = target.style.height !== '' ? target.style.height : currentSize.height;
                var width = target.style.width !== '' ? target.style.width : currentSize.width;

                // add the change in coords to the previous width of the target element
                var newWidth = parseFloat(width) + dx,
                    newHeight = parseFloat(height) + dy;

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
                    },
                    inertia: true
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
         * Resets the size of the widget to initial size.
         * @param target The element to resize to initial size.
         */
        function _resizeToInitial(target) {
            if (target.initialSize) {
                target.style.height = target.initialSize.height + 'px';
                target.style.width = target.initialSize.width + 'px';
            }
        }

        /**
         * Check the element if it's current size is equal or very close to the initial size.
         * @param target The element to check.
         * @returns boolean true if the current size is the initial size, false otherwise.
         */
        function _isInitialSize(target) {
            var currentSize = interact.getElementRect(target);
            var initialSize = target.initialSize;

            // exactly
            if (initialSize.height == currentSize.height && initialSize.width == currentSize.width) {
                return true;
            }

            function near(a, b, maxDistance) {
                for (var distance = 1; distance <= maxDistance; distance++) {
                    if (a + distance == b || a - distance == b) {
                        return true;
                    }
                }
                return false;
            }

            // allow for some margin because the values may already be rounded
            return near(initialSize.height, currentSize.height, 1) && near(initialSize.width, currentSize.width, 1);
        }

        function _getElementSize(target) {
            return interact.getElementRect(target);
        }


        return {
            makeDraggable: _makeDraggable,
            makeDropZone: _makeDropZone,
            on: _on,
            resetPosition: _resetPosition,
            onDoubleTap: function (element, callback) {
                interact(element).on('doubletap', callback);
            },
            makeResizable: _makeResizable,
            resizeToInitial: _resizeToInitial,
            isInitialSize: _isInitialSize,
            getElementSize: _getElementSize
        };
    });

});
