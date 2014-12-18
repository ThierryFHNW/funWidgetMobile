// extend default HTML elements with a data function to save and retrieve data
if (!HTMLElement.prototype.data) {
    HTMLElement.prototype.data = function (key, value) {
        if (arguments.length == 1) {
            if (key in this.data.values) {
                return this.data.values[key];
            }
        } else if (arguments.length > 1) {
            this.data.values[key] = value;
        }
    };
    if (!HTMLElement.prototype.data.values) {
        HTMLElement.prototype.data.values = Object.create(null);
    }
}


define('core', function () {

    var subscribers = Object.create(null);

    function _subscribe(callback) {
        subscribers[callback] = callback;
    }

    function _unsubscribe(callback) {
        delete subscribers[callback]
    }

    function _publish(message) {
        for (var subscriberId in subscribers) {
            subscribers[subscriberId](message);
        }
    }

    return {
        subscribe: _subscribe,
        unsubscribe: _unsubscribe,
        publish: _publish
    }
});


DEBUG = true;
log = function (msg) {
    if (DEBUG) {
        console.log(msg);
    }
};

define('core-loader', ['heir', 'eventEmitter'], function (heir, EventEmitter) {

    function WorkspaceConfig(name) {
        this.name = name;
        this.layout = {};
        this.widgets = [];
    }

    function Layout(name) {
        this.name = name;
        this.document = {};
    }

    function Widget(name) {
        this.name = name;
        this.viewTarget = null;
        this.document = {};
        this.elements = [];
    }

    function Element(name) {
        this.name = name;
    }

    heir.inherit(Element, EventEmitter);
    heir.inherit(Widget, EventEmitter);
    heir.inherit(Layout, EventEmitter);
    heir.inherit(WorkspaceConfig, EventEmitter);


    function Cache() {
        this.objects = {};
    }

    Cache.prototype.add = function (objectId, object) {
        this.objects[objectId] = object;
    };

    Cache.prototype.contains = function (objectId) {
        return this.objects.hasOwnProperty(objectId);
    };

    Cache.prototype.get = function (objectId) {
        return this.objects.hasOwnProperty(objectId) ? this.objects[objectId] : null;
    };

    Cache.prototype.remove = function (objectId) {
        delete this.objects[objectId];
    };

    Cache.prototype.clear = function () {
        this.objects = {};
    };


    function Loader() {

    }

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

    Loader.setUpSubclass = function (className) {
        className.prototype = Object.create(Loader.prototype);
        if (!className.cache) {
            className.cache = new Cache();
        }
        if (!className.loading) {
            className.loading = new Cache();
        }
    };


    function ElementLoader() {

    }

    Loader.setUpSubclass(ElementLoader);

    ElementLoader.prototype.load = function (name, onLoadedCallback) {
        var url = 'elements/' + name + '.html';
        if (ElementLoader.cache.contains(url)) {
            log('Element ' + name + ' already in cache');
            var element = ElementLoader.loading.get(url);
            onLoadedCallback(element);
        } else if (ElementLoader.loading.contains(url)) {
            log('Element ' + name + ' is loading');
            var loadingElement = ElementLoader.loading.get(url);
            loadingElement.addOnceListener('loaded', onLoadedCallback);
        } else {
            log('Element ' + name + ' is new');
            ElementLoader.loading.add(url, new Element(name));
            this.loadHtml(url, function () {
                var element = ElementLoader.loading.get(url);
                ElementLoader.cache.add(element);
                ElementLoader.loading.remove(url);
                log('Element ' + name + ' has been loaded');
                onLoadedCallback(element);

                // notify the listeners added while the element was loading
                element.emitEvent('loaded', element);
            });
        }
    };

    function WidgetLoader() {
        this.config = {};
        this.numberOfElements = null;
        this.numberOfElementsLoaded = 0;
        this.indexHtmlLoaded = false;
        this.widget = null;
        this.configUrl = null;
        this.onLoadedCallback = function () {
        };
    }

    Loader.setUpSubclass(WidgetLoader);

    WidgetLoader.prototype.load = function (name, onLoadedCallback) {
        this.onLoadedCallback = onLoadedCallback;
        this.configUrl = 'widgets/' + name + '/widget.json';

        if (WidgetLoader.cache.contains(this.configUrl)) {
            log('Widget ' + name + ' already in cache');
            var widget = WidgetLoader.cache.get(this.configUrl);
            onLoadedCallback(widget);
        } else if (WidgetLoader.loading.contains(this.configUrl)) {
            log('Widget ' + name + ' is loading');
            var loadingWidget = WidgetLoader.loading.get(this.configUrl);
            loadingWidget.addOnceListener('loaded', onLoadedCallback);
        } else {
            log('Widget ' + name + ' is new');
            this.widget = new Widget(name);
            WidgetLoader.loading.add(this.configUrl, this.widget);
            this.loadJson(this.configUrl, function (config) {
                this.config = config;
                var widget = WidgetLoader.loading.get(this.configUrl);
                if (widget !== this.widget) {
                    log('Error, something is wrong. The widget from the loading cache does not match the widget created in the class.');
                    return;
                }

                // load dependencies (elements)
                if (config.hasOwnProperty('elements')) {
                    this._loadElements(config.elements);
                } else {
                    log('Widget ' + name + ' has no elements');
                }

                // load index.html
                this._loadIndexHtml();

            }.bind(this));
        }
    };

    WidgetLoader.prototype._loadElements = function (elementArray) {
        this.numberOfElements = elementArray.length;
        log('Widget ' + name + ' has ' + this.numberOfElements + ' elements');
        elementArray.forEach(function (elementName) {
            var loader = new ElementLoader();
            loader.load(elementName, function (element) {
                this.widget.elements.push(element);
                this.numberOfElementsLoaded += 1;
                this._checkIfLoadingComplete();
            }.bind(this));
        }.bind(this));
    };

    WidgetLoader.prototype._checkIfLoadingComplete = function () {
        if (this.numberOfElements == this.numberOfElementsLoaded && this.indexHtmlLoaded) {
            log('Widget ' + this.widget.name + ' has been loaded');
            WidgetLoader.cache.add(this.configUrl, this.widget);
            WidgetLoader.loading.remove(this.configUrl);
            this.widget.emitEvent('loaded', this.widget);
            this.onLoadedCallback(this.widget);
        }
    };

    WidgetLoader.prototype._loadIndexHtml = function () {
        var htmlUrl = 'widgets/' + this.widget.name + '/index.html';
        this.loadHtml(htmlUrl, function (e) {
            console.log('Loaded widget html: ' + e.target.href);
            this.indexHtmlLoaded = true;
            this.widget.document = e.target.import;
            this._checkIfLoadingComplete();
        }.bind(this));
    };


    function LayoutLoader() {
        this.layout = null;
    }

    Loader.setUpSubclass(LayoutLoader);

    LayoutLoader.prototype.load = function (name, onLoadedCallback) {
        var url = 'layouts/' + name + '.html';
        if (LayoutLoader.cache.contains(url)) {
            log('Layout ' + name + ' already in cache');
            var layout = WidgetLoader.cache.get(url);
            onLoadedCallback(layout);
        } else if (LayoutLoader.loading.contains(url)) {
            log('Layout ' + name + ' is loading');
            var loadingLayout = LayoutLoader.loading.get(url);
            loadingLayout.addOnceListener('loaded', onLoadedCallback);
        } else {
            log('Layout ' + name + ' is new');
            this.layout = new Layout(name);
            LayoutLoader.loading.add(url, this.layout);


            this.loadHtml(url, function (e) {
                console.log('Loaded layout html: ' + e.target.href);

                var layout = LayoutLoader.loading.get(url);
                if (layout !== this.layout) {
                    log('Error, something is wrong. The layout from the loading cache does not match the layout created in the class.');
                    return;
                }
                LayoutLoader.cache.add(url, layout);
                LayoutLoader.loading.remove(url);

                this.layout.document = e.target.import;
                onLoadedCallback(this.layout);
                this.layout.emitEvent('loaded', this.layout);
            }.bind(this));
        }
    };

    function WorkspaceConfigLoader() {
        this.workspaceConfig = {};
        this.layoutLoaded = false;
        this.numberOfWidgets = null;
        this.numberOfWidgetsLoaded = 0;
        this.onLoadedCallback = function () {
        };
    }

    Loader.setUpSubclass(WorkspaceConfigLoader);

    WorkspaceConfigLoader.prototype.load = function (name, onLoadedCallback) {
        this.onLoadedCallback = onLoadedCallback;
        var configUrl = 'workspace-configs/' + name + '.json';

        if (WorkspaceConfigLoader.cache.contains(configUrl)) {
            log('WorkspaceConfig ' + name + ' already in cache');
            var workspaceConfig = WorkspaceConfigLoader.cache.get(configUrl);
            onLoadedCallback(workspaceConfig);
        } else if (WorkspaceConfigLoader.loading.contains(configUrl)) {
            log('WorkspaceConfig ' + name + ' is loading');
            var loadingWorkspaceConfig = WorkspaceConfigLoader.loading.get(configUrl);
            loadingWorkspaceConfig.addOnceListener('loaded', onLoadedCallback);
        } else {
            log('WorkspaceConfig ' + name + ' is new');
            this.workspaceConfig = new WorkspaceConfig(name);
            WorkspaceConfigLoader.loading.add(configUrl, this.workspaceConfig);
            this.loadJson(configUrl, function (config) {
                this.config = config;
                var workspaceConfig = WorkspaceConfigLoader.loading.get(configUrl);
                if (workspaceConfig !== this.workspaceConfig) {
                    log('Error, something is wrong. The config from the loading cache does not match the config created in the class.');
                    return;
                }

                // load layout
                if (!this.config.hasOwnProperty('layout')) {
                    log('Loading failed: WorkspaceConfig has no layout!');
                    return;
                }
                var layoutLoader = new LayoutLoader();
                layoutLoader.load(this.config.layout, function (layout) {
                    this.layoutLoaded = true;
                    this.workspaceConfig.layout = layout;
                    this._checkIfLoadingComplete();
                }.bind(this));


                // load widgets
                this._loadWidgets();


            }.bind(this));
        }
    };

    WorkspaceConfigLoader.prototype._loadWidgets = function () {
        // k: widgetname, v: viewTarget
        var widgetsToLoad = Object.create(null);
        if (!this.config.hasOwnProperty('mainWorkspace') || !this.config.mainWorkspace) {
            log(this.config.name + ' does not have a main workspace!');
            return;
        }
        widgetsToLoad[this.config.mainWorkspace] = 'mainWorkspace';

        if (this.config.hasOwnProperty('sideWorkspaceLeft') && this.config.sideWorkspaceLeft) {
            log(this.config.name + ' has a side workspace left');
            widgetsToLoad[this.config.sideWorkspaceLeft] = 'sideWorkspaceLeft';
        }

        if (this.config.hasOwnProperty('sideWorkspaceRight') && this.config.sideWorkspaceRight) {
            log(this.config.name + ' has a side workspace right');
            widgetsToLoad[this.config.sideWorkspaceRight] = 'sideWorkspaceRight';
        }


        if (this.config.hasOwnProperty('widgets') && Object.keys(this.config.widgets).length > 0) {
            log(this.config.name + ' has free widgets');
            var freeWidgets = 0;
            for (var widgetName in this.config.widgets) {
                if (this.config.widgets.hasOwnProperty(widgetName)) {
                    widgetsToLoad[widgetName] = 'widget' + (freeWidgets++);
                }
            }
        }
        this.numberOfWidgets = Object.keys(widgetsToLoad).length;
        log(this.config.name + ' has ' + this.numberOfWidgets + ' widgets');
        for (var widgetName in widgetsToLoad) {
            var widgetLoader = new WidgetLoader();
            widgetLoader.load(widgetName, function (widget) {
                widget.viewTarget = widgetsToLoad[widgetName];
                this.workspaceConfig.widgets.push(widget);
                this.numberOfWidgetsLoaded += 1;
                this._checkIfLoadingComplete();
            }.bind(this));
        }

    };


    WorkspaceConfigLoader.prototype._checkIfLoadingComplete = function () {
        if (this.layoutLoaded && this.numberOfWidgets == this.numberOfWidgetsLoaded) {
            log('WorkspaceConfig ' + this.workspaceConfig.name + ' has been loaded');
            WorkspaceConfigLoader.cache.add(this.configUrl, this.widget);
            WorkspaceConfigLoader.loading.remove(this.configUrl);
            this.workspaceConfig.emitEvent('loaded', this.workspaceConfig);
            this.onLoadedCallback(this.workspaceConfig);
        }
    };


    return {
        runTests: function () {
            /*
             BEGIN TESTS
             */

            var wcl = new WorkspaceConfigLoader();
            wcl.load('sprintplanning2', function (wConfig) {
                console.log('%%% loaded workspaceConfig');
                console.dir(wConfig);
            });

            //var wl = new WidgetLoader();
            //wl.load('sprintplanning2', function (widget) {
            //    log('## widget has been loaded');
            //    console.dir(widget);
            //});
            //
            //var ll = new LayoutLoader();
            //ll.load('workspace', function (layout) {
            //    log('## layout loaded');
            //    console.dir(layout);
            //});

            /*
             END TESTS
             */
        }
    }

});


/**
 * core-loader
 *
 * Loads components.
 */
define('core-loader-obsolete', function () {

    function _dispatchLoad(componentName, target) {
        require(['config'], function (config) {
            var loader = new Component(componentName, config, target);
            loader.load();
        });
    }

    function Component(id, globalConfig, target, parent, workspace) {
        this.id = id;
        this.globalConfig = globalConfig;
        this.target = target;
        this.parent = parent;
        this.workspace = workspace;
        this.children = [];
        this.config = null;
        this.document = null;
        this.configPath = this.globalConfig.src + '/' + this.id + '/' + this.globalConfig.configFileUrl;
    }

    Component.prototype._getPath = function (fileName) {
        return this.globalConfig.src + '/' + this.id + '/' + fileName;
    };


    Component.prototype.load = function () {
        this._getJSON(this.configPath, this._loadComponent.bind(this), this._loadComponentCfgFailed.bind(this));
    };

    Component.prototype._getJSON = function (url, onSuccessCallback, onErrorCallback) {
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

    Component.prototype._loadComponentCfgFailed = function (status, statusMsg, response) {
        console.log('Error: ' + status + ' ' + statusMsg + ', ' + response);
    };

    Component.prototype._loadComponent = function (componentCfg) {
        console.log('loading ' + componentCfg.name + ' component');
        this.config = componentCfg;

        // initialize a workspace for the top component
        if (!this.parent && !this.workspace) {
            // load workspace
            if (this.config.hasOwnProperty('workspace')) {
                this._loadWorkspace(this.config.workspace)
            } else {
                console.log('Error, a top component must have a workspace!');
            }
        }

        // load dependencies
        if (this.config.hasOwnProperty('dependencies')) {
            this.config.dependencies.forEach(this._loadDependency, this);
        }

        // load the html and js files
        if (this.config.hasOwnProperty('htmlFiles')) {
            this.config.htmlFiles.forEach(this._loadHtml, this);
        }
    };

    Component.prototype._loadWorkspace = function (id) {
        console.log('loading workspace: ' + id);
        var link = document.createElement('link');
        link.rel = 'import';
        link.href = this.globalConfig.src + '/' + id + '/workspace.html';
        link.addEventListener('load', this._workspaceLoaded.bind(this));
        document.head.appendChild(link);
    };

    Component.prototype._workspaceLoaded = function (e) {
        var workspace = document.createElement('workspace-layout');
        workspace.loaded = true;
        workspace.setContent('widget1', null);
        this.target.appendChild(workspace);
    };

    Component.prototype._loadDependency = function (dependencyObj) {
        console.log('loading dependency ' + dependencyObj.id);
        var dependency = new Component(dependencyObj.id, this.globalConfig, this.target, this, this.workspace);
        dependency.load();
        this.children.push(dependency);
    };

    Component.prototype._loadHtml = function (htmlFile) {
        var link = document.createElement('link');
        link.rel = 'import';
        link.href = this._getPath(htmlFile);
        link.addEventListener('load', this._htmlLoaded.bind(this));

        document.head.appendChild(link);
    };

    Component.prototype._htmlLoaded = function (e) {
        console.log('Loaded import: ' + e.target.href);

        // add to document after loaded
        var div = document.createElement('div');
        var root = div.createShadowRoot();
        this.document = root;

        // add templates to document in a shadow root
        var templates = e.target.import.querySelectorAll('template.content');
        console.log('found templates: ' + templates.length);
        for (var i = 0; i < templates.length; i++) {
            // add content of template
            var content = document.importNode(templates[i].content, true);
            root.appendChild(content);
        }
        this.target.appendChild(div);
    };

    return {
        load: _dispatchLoad
    }
});


/**
 * core-dnd
 *
 * Provide drag and drop support provided by interact.js.
 */
require(['interact'], function (interact) {
    define('core-dnd', function () {

        var startPos = {x: 0, y: 0};

        function _draggableEnableSnapping(element) {
            // snap to drag zone
            interact(element).snap({
                mode: 'anchor',
                anchors: [],
                range: Infinity,
                elementOrigin: {x: 0.5, y: 0.5},
                endOnly: true
            });
            // revert back to starting point if not dropped in another drop zone
            interact(element).on('dragstart', function (event) {
                var rect = interact.getElementRect(event.target);

                // record center point when starting a drag
                startPos = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
                // snap to the start position
                event.interactable.snap({anchors: [startPos]});
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

                event.draggable.snap({
                    anchors: [dropCenter]
                });
            });
            interact(element).on('dragleave', function (event) {
                // snap to the start position
                event.interactable.snap({anchors: [startPos]});
            });
        }

        function _makeDropZone(element, acceptSelector) {
            interact(element).dropzone({
                // only accept elements matching this CSS selector
                accept: acceptSelector,
                // Require a 50% element overlap for a drop to be possible
                overlap: 0.5,

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

        function _makeDraggable(element) {
            interact(element).draggable({
                // call this function on every dragmove event
                onmove: function (event) {
                    var target = event.target,
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
                    event.target.style.zIndex = '';
                },
                onstart: function (event) {
                    // make sure the draggable is always over the other elements
                    event.target.style.zIndex = '100';
                }
            }).inertia(true);

            _draggableEnableSnapping(element);
        }

        function _addInteractEventListener(element, event, callback) {
            interact(element).on(event, callback);
        }

        return {
            /**
             * Makes an element a draggable.
             * @param element The element to make draggable.
             */
            makeDraggable: _makeDraggable,
            /**
             * Makes an element a drop-zone for a draggable.
             * @param element The element to make a drop zone.
             * @param acceptSelector The CSS selector a draggable needs to have in order to be accepted by this drop-zone.
             */
            makeDropZone: _makeDropZone,
            /**
             * Adds an event listener to the draggable or the drop-zone.
             * See the interact.js documentation for a list of events.
             * @param element The element to register the listener on.
             * @param event The name of the event.
             * @param callback The function that is called on the event.
             */
            addInteractEventListener: _addInteractEventListener
        }
    });

});
