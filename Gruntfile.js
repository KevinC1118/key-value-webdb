/* globals module */
'use strict';

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
            '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
            '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
            '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
            ' Licensed <%= props.license %> */\n',
        // Task configuration.
        clean: {
            coffee: ['src/js']
        },
        coffee: {
            compile: {
                options: {
                    bare: true
                },
                expand: true,
                flatten: true,
                cwd: 'coffee',
                src: ['*.coffee'],
                dest: 'src/js',
                ext: '.js'
            }
        },
        jshint: {
            options: {
                curly: false,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                unused: true,
                boss: true,
                eqnull: true,
                browser: true,
                devel: true,
                shadow: true,
                validthis: true,
                globals: {
                    describe: true,
                    it: true,
                    runs: true,
                    waitsFor: true,
                    expect: true,
                    beforeEach: true,
                    afterEach: true
                },
                '-W055': true
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            test: {
                src: ['test/spec/**/*.js']
            },
            js: {
                src: ['src/**/*.js']
            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib_test: {
                files: '<%= jshint.libTest.src %>',
                tasks: ['jshint:libTest', 'qunit']
            }
        },
        connect: {
            options: {
                port: 8888
            },
            test: {
                options: {
                    hostname: '*',
                    keepalive: true
                }
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-coffee');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-clean');

    // Default task.
    grunt.registerTask('default', ['jshint']);

    grunt.registerTask('compile', ['clean:coffee', 'coffee:compile', 'jshint:js']);
    grunt.registerTask('test', ['compile', 'jshint:test', 'connect:test']);
};
