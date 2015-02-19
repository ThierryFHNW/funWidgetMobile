DEBUG = false;
log = function (msg) {
    if (DEBUG) {
        console.log(msg);
    }
};

/**
 * Handles the URLs and the routing.
 */
define('core-routing', function () {

    return {
        /**
         * Enable routing for the application.
         *
         * @param urlPathToWorkspaceConfig Map of URLs to WorkspaceConfig objects.
         */
        enable: function (urlPathToWorkspaceConfig) {
            var routers = document.getElementsByTagName('app-router');
            if (routers.length != 1) {
                console.error('Error, none or more app-router elements. Exactly one is needed!');
                return;
            }
            var router = routers[0];
            router.setRoutes(urlPathToWorkspaceConfig);
            router.routeChanged();
        }
    }
});

/**
 * Loads the workspace configs and the dependent resources.
 */
define('core-loader', ['heir', 'eventEmitter'], function (heir, EventEmitter) {

    /**
     * Represents a workspace-configuration.
     *
     * @param name The name of the workspace-config.
     * @constructor
     */
    function WorkspaceConfig(name) {
        this.name = name;
        this.path = null;
        this.layout = {};
        this.widgets = [];
        this.workspace = null;
    }

    /**
     * Represents a layout.
     *
     * @param name The name of the layout.
     * @constructor
     */
    function Layout(name) {
        this.name = name;
        this.document = {};
    }

    /**
     * Represents a widget.
     *
     * @param name The name of the widget.
     * @constructor
     */
    function Widget(name) {
        this.name = name;
        this.viewTarget = null;
        this.document = {};
        this.elements = [];
    }

    /**
     * Represents an element.
     *
     * @param name The name of the element.
     * @constructor
     */
    function Element(name) {
        this.name = name;
    }

    // All resource representations inherit from EventEmitter. Gives them addEventListener and emitEvent.
    heir.inherit(Element, EventEmitter, true);
    heir.inherit(Widget, EventEmitter, true);
    heir.inherit(Layout, EventEmitter, true);
    heir.inherit(WorkspaceConfig, EventEmitter, true);


    /**
     * Shows the workspace. Builds it if necessary.
     */
    WorkspaceConfig.prototype.show = function () {
        var WORKSPACE_ID = 'workspace';

        if (this.workspace == null) {
            this.workspace = this.build();
            this.workspace.setAttribute('id', WORKSPACE_ID);
        }

        var currentWorkspace = document.getElementById(WORKSPACE_ID);
        if (currentWorkspace != null) {
            document.body.removeChild(currentWorkspace);
        }

        document.body.appendChild(this.workspace);
    };

    /**
     * Builds and loads the workspace.
     *
     * @returns {HTMLElement} The root node of the workspace.
     */
    WorkspaceConfig.prototype.build = function () {
        var workspace = document.createElement('workspace-layout-' + this.layout.name);
        this.widgets.forEach(function (widget) {
            var templates = widget.document.querySelectorAll('template.content');
            console.log('widget ' + widget.name + ' has ' + templates.length + ' template(s)');
            if (templates.length == 0) {
                console.log('no templates found in the widget ' + widget.name);
                return;
            }
            var content = document.importNode(templates[0].content, true);
            workspace.addWidget(widget.viewTarget, content);
        });
        return workspace;
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

    // All Loaders inherit from Loader
    heir.inherit(WorkspaceConfigLoader, Loader, true);
    heir.inherit(LayoutLoader, Loader, true);
    heir.inherit(ElementLoader, Loader, true);
    heir.inherit(WidgetLoader, Loader, true);

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
                    onSuccessCallback && onSuccessCallback(data);
                } else {
                    onErrorCallback && onErrorCallback(xhr.status, xhr.statusText, xhr.responseText)
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
     * Loads an element by name.
     *
     * @param name The name of the element.
     * @param onLoadedCallback The function to be called if the element has been loaded.
     */
    ElementLoader.prototype.load = function (name, onLoadedCallback) {
        var url = 'elements/' + name + '.html';
        Loader.prototype.loadResource(url, new Element(name), onLoadedCallback, this.loadHtml);
    };


    /**
     * Loader for widgets.
     *
     * @constructor
     */
    function WidgetLoader() {
        this.config = {};
        this.numberOfElements = null;
        this.numberOfElementsLoaded = 0;
        this.indexHtmlLoaded = false;
        this.widget = null;
        this.configUrl = null;
        this.onResourceLoadedCallback = function () {
        };
    }

    /**
     * Loads the widget by name.
     *
     * @param name The name of the widget.
     * @param onLoadedCallback The function called if the widget has been loaded.
     */
    WidgetLoader.prototype.load = function (name, onLoadedCallback) {
        this.configUrl = 'widgets/' + name + '/widget.json';
        this.widget = new Widget(name);


        function loadWidget(url, onResourceLoadedCallback) {
            this.onResourceLoadedCallback = onResourceLoadedCallback;

            this.loadJson(url, function (config) {
                this.config = config;

                // load dependencies (elements)
                if (config.hasOwnProperty('elements')) {
                    loadElements.call(this, config.elements);
                } else {
                    log('Widget ' + name + ' has no elements');
                }

                // load index.html
                loadIndexHtml.call(this);
            }.bind(this));
        }

        function loadElements(elementArray) {
            this.numberOfElements = elementArray.length;
            log('Widget ' + name + ' has ' + this.numberOfElements + ' elements');
            elementArray.forEach(function (elementName) {
                var loader = new ElementLoader();
                loader.load(elementName, function (element) {
                    this.widget.elements.push(element);
                    this.numberOfElementsLoaded += 1;
                    onDependencyLoaded.call(this);
                }.bind(this));
            }.bind(this));
        }

        function loadIndexHtml() {
            var htmlUrl = 'widgets/' + this.widget.name + '/index.html';
            this.loadHtml(htmlUrl, function (e) {
                console.log('Loaded widget html: ' + e.target.href);
                this.indexHtmlLoaded = true;
                this.widget.document = e.target.import;
                onDependencyLoaded.call(this);
            }.bind(this));
        }

        function onDependencyLoaded() {
            if (this.numberOfElements == this.numberOfElementsLoaded && this.indexHtmlLoaded) {
                log('Widget ' + this.widget.name + ' has been loaded');
                this.onResourceLoadedCallback();
            }
        }


        Loader.prototype.loadResource(this.configUrl, this.widget, onLoadedCallback, loadWidget.bind(this));
    };


    /**
     * Loader for layouts.
     *
     * @constructor
     */
    function LayoutLoader() {
        this.layout = null;
    }

    /**
     * Loads a layout by name.
     *
     * @param name The name of the layout.
     * @param onLoadedCallback The function called if the layout has been loaded.
     */
    LayoutLoader.prototype.load = function (name, onLoadedCallback) {
        var url = 'layouts/' + name + '.html';
        this.layout = new Layout(name);
        Loader.prototype.loadResource(url, this.layout, onLoadedCallback, this.loadHtml);
    };


    /**
     * Workspace-config loader.
     *
     * @constructor
     */
    function WorkspaceConfigLoader() {
        this.workspaceConfig = {};
        this.layoutLoaded = false;
        this.numberOfWidgets = null;
        this.numberOfWidgetsLoaded = 0;
        this.onResourceLoadedCallback = function () {
        };
    }

    /**
     * Loads workspace-configs by name.
     *
     * @param name The name of the workspace-config.
     * @param onLoadedCallback The function called if the workspace-config has been loaded.
     */
    WorkspaceConfigLoader.prototype.load = function (name, onLoadedCallback) {
        var configUrl = 'workspace-configs/' + name + '.json';
        this.workspaceConfig = new WorkspaceConfig(name);

        function loadWorkspaceConfig(url, onResourceLoadedCallback) {
            this.onResourceLoadedCallback = onResourceLoadedCallback;
            this.loadJson(url, configLoaded.bind(this));
        }

        function configLoaded(config) {
            this.config = config;

            // set the URL path
            if (!config.hasOwnProperty('path')) {
                console.error('Error, the workspace config has no path attribute!');
                return;
            }
            this.workspaceConfig.path = config.path;

            // load layout
            if (!this.config.hasOwnProperty('layout')) {
                console.error('Loading failed: WorkspaceConfig has no layout!');
                return;
            }
            var layoutLoader = new LayoutLoader();
            layoutLoader.load(this.config.layout, layoutLoaded.bind(this));

            // load widgets
            loadWidgets.call(this);
        }

        function layoutLoaded(layout) {
            this.layoutLoaded = true;
            this.workspaceConfig.layout = layout;
            onDependencyLoaded.call(this);
        }

        function loadWidgets() {
            // k: widgetname, v: viewTarget
            var widgetsToLoad = Object.create(null);
            if (!this.config.hasOwnProperty('mainWorkspace') || !this.config.mainWorkspace) {
                log(this.config.name + ' does not have a main workspace!');
                return;
            }
            widgetsToLoad[this.config.mainWorkspace] = 'mainWorkspace';

            if (this.config.hasOwnProperty('widgets') && Object.keys(this.config.widgets).length > 0) {
                log(this.config.name + ' has free widgets');
                for (var widgetName in this.config.widgets) {
                    if (this.config.widgets.hasOwnProperty(widgetName)) {
                        widgetsToLoad[widgetName] = this.config.widgets[widgetName];
                    }
                }
            }

            this.numberOfWidgets = Object.keys(widgetsToLoad).length;
            log(this.config.name + ' has ' + this.numberOfWidgets + ' widgets');
            for (var widgetName in widgetsToLoad) {
                var widgetLoader = new WidgetLoader();
                widgetLoader.load(widgetName, function (widget) {
                    widget.viewTarget = widgetsToLoad[widget.name];
                    this.workspaceConfig.widgets.push(widget);
                    this.numberOfWidgetsLoaded += 1;
                    onDependencyLoaded.call(this);
                }.bind(this));
            }

        }

        function onDependencyLoaded() {
            if (this.layoutLoaded && this.numberOfWidgets == this.numberOfWidgetsLoaded) {
                log('WorkspaceConfig ' + this.workspaceConfig.name + ' has been loaded');
                this.onResourceLoadedCallback();
            }
        }


        Loader.prototype.loadResource(configUrl, this.workspaceConfig, onLoadedCallback, loadWorkspaceConfig.bind(this))
    };


    return {
        /**
         * Creates a workspace-config loader.
         *
         * @returns {WorkspaceConfigLoader}
         */
        createWorkspaceConfigLoader: function () {
            return new WorkspaceConfigLoader();
        }
    }

});


/**
 * core-touch
 *
 * Provides drag and drop support provided by interact.js.
 */
require(['interact'], function (interact) {
    define('core-touch', function () {

        function _draggableEnableSnapping(element) {
            // snap to drag zone
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
                    if (onDropCallback != undefined) {
                        // call the callback with the data of the interaction set by the draggable in onstart.
                        onDropCallback(event.interaction.data);
                    }
                },
                ondropdeactivate: function (event) {
                    // remove active dropzone feedback
                    event.target.classList.remove('drop-active');
                    event.target.classList.remove('drop-entered');
                    event.relatedTarget.classList.remove('can-drop');
                }
            });

            _dropZoneEnableSnapping(element);
        }

        /**
         * Makes an element a draggable.
         * @param element The element to make draggable.
         * @param options Options to configure the draggable.
         *      Available options:
         *          clone: boolean  // clones the draggable element and appends it to document.body.
         *          data: object // the data to attach to the interaction. Will be available to the dropzone in ondrop.
         *
         */
        function _makeDraggable(element, options) {
            if (options === undefined) {
                options = {};
            }
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
                },
                onend: function (event) {
                    // reset z-index to the default value
                    this.target.style.zIndex = '';
                    this.target.classList.remove('dragging');

                    // remove clone
                    if (this.target !== event.target) {
                        document.body.removeChild(this.target);
                    }
                },
                onstart: function (event) {
                    // attach data to the interaction
                    if (options.hasOwnProperty('data')) {
                        event.interaction.data = options.data;
                    }

                    // clone if set in options
                    if (options.hasOwnProperty('clone') === true) {
                        this.target = event.target.cloneNode(true);
                        // copy style definitions recursively
                        function applyStyle(source, target) {
                            target.style.cssText = window.getComputedStyle(source, null).cssText;
                            if (target.childElementCount > 0) {
                                for (var i = 0; i < source.childElementCount; i++) {
                                    applyStyle(source.children[i], target.children[i]);
                                }
                            }
                        }

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
                }
            });

            _draggableEnableSnapping(element);
        }

        /**
         * Adds an event listener to the draggable or the drop-zone.
         * See the interact.js documentation for a list of events.
         * @param element The element to register the listener on.
         * @param event The name of the event.
         * @param callback The function that is called on the event.
         */
        function _addInteractEventListener(element, event, callback) {
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

        return {
            makeDraggable: _makeDraggable,
            makeDropZone: _makeDropZone,
            addInteractEventListener: _addInteractEventListener,
            resetPosition: _resetPosition,
            onDoubleTap: function (element, callback) {
                interact(element).on('doubletap', callback);
            }
        }
    });

});
