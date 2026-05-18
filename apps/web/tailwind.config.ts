import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#FAF6EE",
          primary: "#D32027",
        },
      },
      fontFamily: {
        sans: ["Cairo", "system-ui", "sans-serif"],
        display: ["Tajawal", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
