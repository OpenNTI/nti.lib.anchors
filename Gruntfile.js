'use strict';

module.exports = function(grunt) {
	// Let *load-grunt-tasks* require everything
	require('load-grunt-tasks')(grunt);

	grunt.initConfig({

		karma: {
			unit: {
				configFile: 'karma.conf.js'
			}
		},


		eslint: {
			target: [
				'lib/*.js',
				'test/*.js',
				'*.js'
			]
		}
	});

	//grunt.registerTask('docs',['jsdoc']);
	grunt.registerTask('lint', ['eslint']);
	grunt.registerTask('test', ['karma']);
	grunt.registerTask('default', ['eslint']);

};
