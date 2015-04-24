module.exports = function (grunt) {

    // Load grunt tasks automatically
    require('load-grunt-tasks')(grunt);

    // Time how long tasks take. Can help when optimizing build times
    require('time-grunt')(grunt);

    // Project configuration.
    grunt.initConfig({
            pkg: grunt.file.readJSON('package.json'),

            // Make sure code styles are up to par and there are no obvious mistakes
            jshint: {
                options: {
                    jshintrc: '.jshintrc',
                    reporter: require('jshint-stylish'),
                    extract: 'auto', // extracts the JS from HTML files to correctly check it
                    ignores: ['app/bower_components/']
                },
                all: [
                    'Gruntfile.js',
                    'app/{,*/}*.js',
                    'app/{,*/}*.html'
                ],
                test: {
                    //options: {
                    //    jshintrc: 'test/.jshintrc'
                    //},
                    src: ['test/spec/{,*/}*.js']
                }
            },

            // Automatically inject Bower components into the app
            'wiredep': {
                target: {
                    src: [
                        'app/index.html'
                    ],
                    exclude: [
                        // polymer
                        'bower_components/webcomponentsjs/webcomponents.js',
                        'bower_components/polymer/polymer.js'
                    ]
                }
            },

            // minify js code
            uglify: {
                options: {
                    banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
                    mangle: false
                },
                build: {
                    src: 'app/{,**/}*.js',
                    dest: 'build/<%= pkg.name %>.min.js'
                }
            },

            vulcanize: {
                default: {
                    options: {
                        // Task-specific options go here.
                        inline: true,
                        csp: false,
                        strip: false

                    },
                    files: {
                        // Target-specific file lists and/or options go here.
                        'build/index.html': '{,*/}*.html'
                    }
                }
            },

            // The actual grunt server settings
            connect: {
                options: {
                    port: 9000,
                    // Change this to '0.0.0.0' to access the server from outside.
                    hostname: '127.0.0.1',
                    livereload: 35729
                },
                livereload: {
                    options: {
                        open: true,
                        base: [
                            '.tmp',
                            'app'
                        ]
                    }
                }
            },

            // Watches files for changes and runs tasks based on the changed files
            watch: {
                js: {
                    files: [
                        'app/*.js',
                        'app/components/**/*.js'],
                    tasks: ['newer:jshint:all'],
                    options: {
                        livereload: true
                    }
                },
                jsTest: {
                    files: ['test/spec/{,*/}*.js'],
                    tasks: ['newer:jshint:test', 'karma']
                },
                styles: {
                    files: [
                        'app/main.css',
                        'app/components/**/*.css'
                    ],
                    tasks: ['newer:copy:styles', 'autoprefixer']
                },
                gruntfile: {
                    files: ['Gruntfile.js']
                },
                livereload: {
                    options: {
                        livereload: '<%= connect.options.livereload %>'
                    },
                    files: [
                        'app/**/*.html',
                        'app/**/*.js',
                        '.tmp/styles/{,*/}*.css',
                        'app/components/**/*.{png,jpg,jpeg,gif,webp,svg,json}'
                    ]
                }
            },

            // Copies remaining files to places other tasks can use
            copy: {
                dist: {
                    files: [{
                        expand: true,
                        dot: true,
                        cwd: 'app',
                        dest: 'dist',
                        src: [
                            '*.{ico,png,txt}',
                            '.htaccess',
                            '*.html',
                            '*.js',
                            'bower_components/**/*',
                            'components/**/*'
                        ]
                    }, {
                        expand: true,
                        cwd: '.tmp/images',
                        dest: 'dist/images',
                        src: ['generated/*']
                    }]
                },
                styles: {
                    expand: true,
                    cwd: 'app/styles',
                    dest: '.tmp/styles/',
                    src: '{,*/}*.css'
                }
            },

            // Run some tasks in parallel to speed up the build process
            concurrent: {
                server: [
                    'copy:styles'
                ],
                test: [
                    'copy:styles'
                ],
                dist: [
                    'copy:styles',
                    'imagemin',
                    'svgmin'
                ]
            },

            // Empties folders to start fresh
            clean: {
                dist: {
                    files: [{
                        dot: true,
                        src: [
                            '.tmp',
                            'dist/*',
                            'dist/.git*'
                        ]
                    }]
                },
                server: '.tmp'
            }
        }
    );


    grunt.registerTask('serve', function (target) {
        if (target === 'dist') {
            return grunt.task.run(['build', 'connect:dist:keepalive']);
        }

        grunt.task.run([
            'jshint',
            'clean:server',
            'wiredep',
            'concurrent:server',
            'connect:livereload',
            'watch'
        ]);
    });

// Default task(s).
    grunt.registerTask('default', ['serve']);

};