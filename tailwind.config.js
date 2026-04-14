/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        papier: '#F5F0E8',
        rouge: '#C8402A',
        noir: '#1A1916',
        surface: '#FDFCF9',
        bordure: '#D6CFC3',
        muted: '#B5AFA5',
      },
      fontFamily: {
        titre: ['Georgia', 'Times New Roman', 'serif'],
        data: ['SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
