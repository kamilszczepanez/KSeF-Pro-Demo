/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- To jest kluczowe dla trybu ciemnego
  theme: {
    extend: {},
  },
  plugins: [],
}