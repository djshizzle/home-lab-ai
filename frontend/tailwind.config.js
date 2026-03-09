/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        webex: {
          blue: "#00BCEB",
          dark: "#1B1B2F",
          green: "#00D68F",
          orange: "#FF6B35",
          purple: "#6B4EFF",
        },
      },
    },
  },
  plugins: [],
};
