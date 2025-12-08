import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  publicDir: path.resolve(__dirname, 'public'),
});
