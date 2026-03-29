import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        monk: "12px"
      },
      boxShadow: {
        monk: "0 18px 48px rgba(57, 56, 42, 0.08)",
        glass: "0 12px 40px rgba(57, 56, 42, 0.08)"
      },
      transitionDuration: {
        180: "180ms",
        220: "220ms"
      },
      maxWidth: {
        reader: "640px"
      }
    }
  },
  plugins: []
};

export default config;
