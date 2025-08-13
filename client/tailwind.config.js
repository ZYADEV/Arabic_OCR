/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        mainWhite: '#EBEBEB',
        mainBlack: '#141414',
      },
      fontFamily: {
        cairo: ['Cairo', 'system-ui', 'sans-serif']
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
        }
      },
      animation: {
        fadeUp: 'fadeUp 400ms ease-out both'
      }
    },
  },
  plugins: [],
}
