/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: '#2F6690',
          dark: '#16324F',
          light: '#7FA9CC',
        },
        spark: '#E8735C',
        ink: '#14212B',
        mist: '#F5F7F8',
        line: '#E2E8ED',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}