const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/wb-tracker':        './src/content/wb-tracker.ts',
    'content/ozon-tracker':      './src/content/ozon-tracker.ts',
    'popup/popup':               './popup/popup.ts',
  },
  output: {
    path:     path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      use:  'ts-loader',
      exclude: /node_modules/,
    }],
  },
  resolve: { extensions: ['.ts', '.js'] },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'popup/popup.html', to: 'popup/popup.html' },
      ],
    }),
  ],
};
