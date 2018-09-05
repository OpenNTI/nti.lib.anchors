module.exports = function (api) {
	api.cache(false);
	return {
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
			}]
		]
	};
};
