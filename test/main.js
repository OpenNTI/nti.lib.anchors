const importAll = x => x.keys().forEach(x);

importAll(require.context('../src/', true, /\.js$/));
