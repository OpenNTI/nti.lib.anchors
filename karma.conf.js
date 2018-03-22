const baseConfig = require('nti-unittesting-clientside');

module.exports = function (config) {
	config.set(Object.assign(baseConfig, {
		files: [
			'test/**/*.js'
		],

		preprocessors: {
			'test/**/*.js': ['webpack', 'sourcemap']
		}
	}));
};
