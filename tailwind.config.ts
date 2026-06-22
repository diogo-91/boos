import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#10233f",
          800: "#16365f",
          700: "#1d477c"
        }
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 35, 63, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
