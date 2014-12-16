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
        var element = ElementLoader.loading.get(url);
        onLoadedCallback(element);
    } else if (ElementLoader.loading.contains(url)) {
        var loadingElement = ElementLoader.loading.get(url);
        loadingElement.once('loaded', onLoadedCallback);
    } else {
        ElementLoader.loading.add(url, new Element(name));
        this.loadHtml(url, function () {
            var element = ElementLoader.loading.get(url);
            ElementLoader.cache.add(element);
            onLoadedCallback(element);

            // notify the listeners added while the element was loading
            element.emit('loaded', element);
        });
    }
};


/*
 BEGIN TESTS
 */
var l = new ElementLoader();
l.loadJson('workspace-configs/sprintplanning2.json', function (data) {
    console.log('loaded json');
    console.dir(data);
    ElementLoader.cache.add("data", data);
});

setTimeout(function () {
    var loader = new ElementLoader();
    var data = ElementLoader.cache.get("data");
    console.dir(data);
}, 500);

/*
 END TESTS
 */


function WorkspaceConfig(name) {
    this.name = name;
    this.configFileUrl = 'workspace-configs/' + name + '.json';
}

function Layout(name) {
    this.name = name;
    this.htmlFile = 'layouts/' + name + '.html';
}

function Widget(name) {
    this.name = name;
    this.config = 'widgets/' + name + '/widget.json';
}

function Element(name) {
    this.name = name;
}

// Emitter prototype mixin for the models
Emitter(WorkspaceConfig.prototype);
Emitter(Layout.prototype);
Emitter(Widget.prototype);
Emitter(Element.prototype);


/**
 * Converts the emitter into a AMD module.
 */
define('emitter', function (require, exports, module) {
    return Emitter;
});


/**
 * core-loader
 *
 * Loads components.
 */
define('core-loader', function () {

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
