import typography from "https://esm.sh/@tailwindcss/typography@0.5.15";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.tsx",
    "./collections/**/*.mdx",
    "./routes/**/*.tsx",
  ],
  theme: {
    extend: {},
  },
  plugins: [typography],
};
