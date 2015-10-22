/*eslint no-var: 0 strict: 0*/
'use strict';

module.exports = function (grunt) {
	// Let *load-grunt-tasks* require everything
	require('load-grunt-tasks')(grunt);

	grunt.initConfig({

		karma: {
			options: {
				configFile: 'karma.conf.js'
			},
			continuous: {
				reporters: ['dots', 'junit'],
				singleRun: true
			},
			unit: {},
			dev: {
				reporters: 'dots',
				singleRun: false,
				autoWatch: true
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
	grunt.registerTask('default', ['eslint']);
	grunt.registerTask('test', function (target) {
		var t = target || 'unit';
		return grunt.task.run([
			'karma:' + t
		]);
	});

};
