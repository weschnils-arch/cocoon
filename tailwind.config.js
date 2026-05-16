/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f4ede0",
        bone: "#e8dec9",
        ink: "#1a1612",
        gold: "#c9a85a",
      },
      fontFamily: {
        sans: ['"Montserrat"', "system-ui", "sans-serif"],
        display: ['"Montserrat"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
