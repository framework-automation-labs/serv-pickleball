// Theme colors that change between light ("Warm sand") and dark ("Night court")
// are CSS variables (see src/index.css), so existing classes like bg-mist,
// text-ink and border-line switch automatically when <html> gets the "dark" class.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: v('court'),
          dark: '#16324F',
          light: '#7FA9CC',
        },
        spark: '#E8735C',
        accent: v('accent'), // coral that stays readable as small text
        link: v('link'), // blue for text links
        heading: v('heading'),
        ink: v('ink'),
        mist: v('mist'), // page background
        sand: v('sand'), // alternate section background
        card: v('card'), // card / input surface
        line: v('line'),
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
