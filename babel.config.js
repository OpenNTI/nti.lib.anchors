'use strict';
const base = require('@nti/lib-scripts/config/babel.config');

module.exports = function (api) {
	return {
		...base(api),
		babelrc: false,
		presets: [
			['@babel/preset-env', {
				targets: {
					browsers: [
						'> 1% in US',
						'last 2 versions',
						'not dead'
					]
				}
			}],
			'@babel/preset-flow'
		]
	};
};
