module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        sass: {
            options: {
                sourcemap: 'none'
            },
            default: {
                files: {
                    'dest/css/popup.css':      'dest/sass/popup.sass',
                    'dest/css/page.css':       'dest/sass/page.sass'
                }
            }
        },

        clean: {
            dest: ['dest/'],
            sass: ['dest/sass']
        },

        copy: {
            'src-to-dest': {
                expand: true,
                cwd: 'src',
                src: ['**/*.*'],
                dest: 'dest/'
            }
        },

        watch: { // Compile everything into one task with Watch Plugin
            default: {
                files: 'src/**/*.*',
                tasks: ['build']
            }
        }
    });

    // Load Grunt plugins
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    // Default task(s).
    grunt.registerTask('build',  ['clean:dest', 'copy:src-to-dest',  'sass', 'clean:sass']);

    grunt.registerTask('default', ['build', 'watch:default']);
};