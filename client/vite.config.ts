import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import svgr from 'vite-plugin-svgr';
import VitePluginHtmlEnv from 'vite-plugin-html-env';
import ViteFaviconsPlugin from 'vite-plugin-favicon';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    VitePluginHtmlEnv(),
    ViteFaviconsPlugin({
      logo: 'public/assets/favicon.png',
      favicons: {
        path: 'assets/',
      },
    }),
  ],
  resolve: {
    alias: {
      '@assets': resolve(__dirname, 'src/assets'),
      '@components': resolve(__dirname, 'src/components'),
      '@constants': resolve(__dirname, 'src/constants'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
      },
    },
  },
});
