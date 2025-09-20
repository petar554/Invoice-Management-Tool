import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  //development server configuration
  server: {
    host: '0.0.0.0',  //allow external connections (for Docker)
    port: 3000,
    strictPort: true, // do not search for available ports if 3000 is taken
    proxy: {
      // proxy API calls to backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  
  //configuration for production
  build: {
    outDir: 'dist',
    sourcemap: false,  //disable source maps for production (security)
    minify: 'esbuild',
    target: 'es2015',
    rollupOptions: {
      output: {
        //code splitting for better caching
        manualChunks: {
          //vendor libraries (rarely change)
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          //routing
          router: ['react-router-dom'],
          //ui libraries
          ui: ['react-hook-form', '@tanstack/react-query', 'react-hot-toast'],
          //utilities
          utils: ['clsx', 'tailwind-merge', 'date-fns', 'axios']
        },
        //asset naming for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    //chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  
  //path aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  },
  
  //environment variables configuration
  envPrefix: 'VITE_',
  
  //CSS configuration
  css: {
    devSourcemap: true,
    postcss: './postcss.config.js'
  },
  
  // optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'react-hook-form',
      '@tanstack/react-query'
    ]
  },
  
  // preview server configuration (for production builds)
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  }
})
