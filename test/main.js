require('babel-polyfill');
if (typeof localStorage !== 'undefined') {
	localStorage.setItem('debug', 'off');
}

const importAll = x => x.keys().forEach(x);

importAll(require.context('../src/', true, /\.js$/));
