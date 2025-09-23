export default {
  plugins: {
    // Tailwind CSS processing
    tailwindcss: {},
    
    // Autoprefixer for cross-browser compatibility
    autoprefixer: {},
    
    // CSS nano for production minification (only in production)
    ...(process.env.NODE_ENV === 'production' && {
      cssnano: {
        preset: [
          'default',
          {
            // optimize CSS for production
            discardComments: {
              removeAll: true,
            },
            normalizeWhitespace: true,
            minifySelectors: true,
            minifyParams: true,
          },
        ],
      },
    }),
  },
}