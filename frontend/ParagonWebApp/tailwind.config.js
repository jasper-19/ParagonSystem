/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,ts,css,scss}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      spacing: {
        180: '45rem',
      },
      zIndex: {
        9999: '9999',
        10000: '10000',
      },
    },
  },
  plugins: [],
};
