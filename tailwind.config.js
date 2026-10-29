/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface": "#f8f9ff",
        "on-error-container": "#93000a",
        "primary": "#000000",
        "on-primary-container": "#7c839b",
        "on-primary": "#ffffff",
        "on-tertiary-fixed-variant": "#93000b",
        "secondary": "#006e2d",
        "on-primary-fixed": "#131b2e",
        "error-container": "#ffdad6",
        "on-tertiary-fixed": "#410002",
        "surface-container-lowest": "#ffffff",
        "secondary-fixed": "#7ffc97",
        "inverse-on-surface": "#eaf1ff",
        "outline": "#76777d",
        "secondary-container": "#7cf994",
        "error": "#ba1a1a",
        "surface-tint": "#565e74",
        "on-background": "#0b1c30",
        "tertiary-fixed": "#ffdad6",
        "background": "#f8f9ff",
        "on-tertiary": "#ffffff",
        "surface-bright": "#f8f9ff",
        "surface-variant": "#d3e4fe",
        "primary-fixed": "#dae2fd",
        "surface-container-low": "#eff4ff",
        "on-tertiary-container": "#f63a35",
        "secondary-fixed-dim": "#62df7d",
        "on-secondary-container": "#007230",
        "surface-dim": "#cbdbf5",
        "on-primary-fixed-variant": "#3f465c",
        "inverse-primary": "#bec6e0",
        "primary-container": "#131b2e",
        "tertiary-container": "#410002",
        "surface-container": "#e5eeff",
        "on-secondary": "#ffffff",
        "on-secondary-fixed-variant": "#005320",
        "tertiary-fixed-dim": "#ffb4ab",
        "outline-variant": "#c6c6cd",
        "tertiary": "#000000",
        "on-surface-variant": "#45464d",
        "on-surface": "#0b1c30",
        "surface-container-high": "#dce9ff",
        "on-error": "#ffffff",
        "on-secondary-fixed": "#002109",
        "surface-container-highest": "#d3e4fe",
        "inverse-surface": "#213145",
        "primary-fixed-dim": "#bec6e0"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "margin": "1rem",
        "space-xl": "2rem",
        "space-sm": "0.75rem",
        "gutter": "1rem",
        "space-xs": "0.5rem"
      },
      fontFamily: {
        "body-md": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "headline-lg-mobile": ["Inter", "sans-serif"]
      },
      fontSize: {
        "body-md": ["15px", { lineHeight: "22px", letterSpacing: "-0.01em", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg-mobile": ["22px", { lineHeight: "28px", letterSpacing: "-0.02em", fontWeight: "600" }]
      }
    }
  },
  plugins: [],
}
