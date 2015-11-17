/*eslint no-var: 0, strict: 0*/
'use strict';
var webpack = require('webpack');

var stat = {
	version: false,
	hash: false,
	timings: false,
	assets: false,
	chunks: false,
	chunkModules: false,
	chunkOrigins: false,
	modules: false,
	cached: false,
	cachedAssets: false,
	showChildren: false,
	source: false,

	colors: true,
	reasons: true,
	errorDetails: true
};

module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine'],

		files: [
			'test/**/*-shims.js',
			'test/**/*.spec.js'
		],

		preprocessors: {
			'test/**/*-shims.js': ['webpack'],
			'test/**/*.spec.js': ['webpack', 'sourcemap']
		},

		exclude: [],

		port: 8090,
		logLevel: config.LOG_WARN,
		colors: true,
		autoWatch: false,
		// Start these browsers, currently available:
		// - Chrome
		// - ChromeCanary
		// - Firefox
		// - Opera
		// - Safari (only Mac)
		// - PhantomJS
		// - IE (only Windows)
		browsers: ['PhantomJS'],


		//coverageReporter: { type: 'html', dir: 'reports/coverage/' },

		htmlReporter: {
			//templatePath: __dirname+'/jasmine_template.html',
			outputDir: 'reports/test-results'
		},

		junitReporter: {
			outputFile: 'reports/test-results.xml',
			suite: ''
		},


		// other possible values: 'dots', 'progress', 'junit', 'html', 'coverage'
		reporters: ['mocha'],
		captureTimeout: 60000,
		singleRun: true,


		webpackServer: {
			stats: stat,
			quiet: true
		},

		webpack: {
			quiet: true,
			cache: true,
			debug: true,
			devtool: 'inline-source-map',

			stats: stat,

			node: {
				net: 'empty',
				tls: 'empty'
			},

			resolve: {
				root: __dirname,
				extensions: ['', '.js']
			},

			plugins: [
				new webpack.DefinePlugin({
					SERVER: false
				})
			],

			module: {
				loaders: [
					{ test: /\.js(x)?$/, loader: 'babel', exclude: /node_modules(\/(?!nti\.)[^\/]+)*$/ },
					{ test: /\.json$/, loader: 'json' }
				]
			}
		}
	});
};
