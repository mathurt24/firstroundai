const path = require('path');
const react = require('@vitejs/plugin-react');

module.exports = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
