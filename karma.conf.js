/*eslint no-var: 0, strict: 0*/
'use strict';

var webpack = require('webpack');

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


		coverageReporter: {
			dir: 'reports/coverage/',
			reporters: [
				{ type: 'html', subdir: 'html' },
				{ type: 'lcov', subdir: 'lcov' },
				{ type: 'cobertura', subdir: '.', file: 'cobertura.xml' },
				{ type: 'lcovonly', subdir: '.', file: 'report-lcovonly.txt' },
				{ type: 'teamcity', subdir: '.', file: 'teamcity.txt' },
				{ type: 'text', subdir: '.', file: 'text.txt' },
				{ type: 'text-summary', subdir: '.', file: 'text-summary.txt' }
			]
		},

		htmlReporter: {
			outputDir: 'reports',
			reportName: 'test-results'
		},

		junitReporter: {
			outputDir: 'reports/test-results/',
			outputFile: 'index.xml',
			suite: 'nti-lib-anchorjs',
			useBrowserName: false
		},


		// other possible values: 'dots', 'progress', 'junit', 'html', 'coverage'
		reporters: ['mocha'],
		captureTimeout: 60000,
		singleRun: true,


		webpackServer: {
			noInfo: true,
			stats: {
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
			}
		},

		webpack: {
			cache: true,
			debug: false,

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
				preLoaders: [
					{
						test: /\.js$/,
						loader: 'isparta-instrumenter',
						exclude: [
							/node_modules/,
							/test/
						]
					}
				],
				loaders: [
					{ test: /\.json$/, loader: 'json' },
					{
						test: /\.js$/,
						loader: 'babel',
						exclude:[
							/node_modules/
						]
					}
				]
			}
		}
	});
};
