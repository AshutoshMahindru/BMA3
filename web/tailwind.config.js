/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        finance: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4', // Primary Cyan
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          glow: 'rgba(6, 182, 212, 0.4)',
        },
        dark: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155'
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5)',
      }
    },
  },
  plugins: [],
};
