import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.js'
    },
    outDir: 'out',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'vscode',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`)
      ],
      output: {
        format: 'cjs',
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      }
    },
    minify: false,
    sourcemap: true,
    target: 'node18'
  },
  resolve: {
    mainFields: ['module', 'jsnext:main', 'jsnext']
  }
});
