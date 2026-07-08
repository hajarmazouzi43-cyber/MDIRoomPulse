 
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mdi: {
          blue: '#0056B3',
          cyan: '#00A3E0',
          free: '#10B981',
          occupied: '#EF4444',
          maintenance: '#F59E0B',
        }
      },
    },
  },
  plugins: [],
}