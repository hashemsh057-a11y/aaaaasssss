import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        glass: "var(--glass)",
        teal: "var(--teal)",
        green: "var(--green)",
        amber: "var(--amber)",
        coral: "var(--coral)",
        graphite: "var(--graphite)"
      },
      fontFamily: {
        inter: ["Inter", "Cairo", "system-ui", "sans-serif"],
        cairo: ["Cairo", "Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        panel: "8px"
      },
      boxShadow: {
        glass: "var(--shadow)"
      }
    }
  },
  plugins: []
};

export default config;
