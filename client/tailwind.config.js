/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core backgrounds
        "huuk-bg": "#0e0d0f",
        "huuk-card": "#1a1a1a",
        "huuk-card-light": "#f7f7f7",
        // Brand accents
        "huuk-accent": "#fcd24d",
        "huuk-purple": "#6661ae",
        "huuk-blue": "#3b82f6",
        "huuk-blue-dark": "#1976d2",
        "huuk-blue-steel": "#6e9fc0",
        // Status colours
        "huuk-green": "#90d14f",
        "huuk-red": "#ec1f23",
        "huuk-yellow": "#ffbf05",
        "huuk-orange": "#ff9800",
        // Text helpers
        "huuk-muted": "#a0b2b8",
        "huuk-subtle": "#888",
      },
      fontFamily: {
        quicksand: ["Quicksand", "sans-serif"],
      },
      borderRadius: {
        "huuk-sm": "8px",
        "huuk-md": "12px",
        "huuk-lg": "20px",
        "huuk-xl": "25px",
      },
      keyframes: {
        pulse: {
          "0%, 100%": {
            transform: "translate(-50%,-50%) scale(1)",
            opacity: "0.7",
          },
          "50%": { transform: "translate(-50%,-50%) scale(1.2)", opacity: "0" },
        },
      },
      animation: {
        pulse: "pulse 2s infinite",
      },
    },
  },
  plugins: [],
};
