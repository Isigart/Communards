/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef9ec',
          100: '#fbf0ca',
          200: '#f7de91',
          300: '#f3c64d',
          400: '#f0b326',
          500: '#e99a0d',
          600: '#ce7508',
          700: '#ab530b',
          800: '#8b4110',
          900: '#733610',
        },
      },
    },
  },
  plugins: [],
};
