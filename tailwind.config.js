/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      spacing: {
        '128': '32rem',
        '144': '36rem',
        '256': '64rem',
        '512': '128rem',
      },
      width: {
        '228': '57rem',
        '3xl': '48rem',
      },
      height: {
        '256': '64rem',
      }
    },
  },
  plugins: [],
}
