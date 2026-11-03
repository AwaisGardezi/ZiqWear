/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ---- ivory brand tokens ----
        paper: "#f4efe6",
        cream: "#ece5d7",
        "cream-deep": "#e4dcc9",
        sand: "#dcd2bd",
        ink: "#1b1714",
        line: "#d7ccb7",
        muted: "#645a4b",
        sale: "#b3382f",
        ok: "#3f7d4c",
        espresso: { DEFAULT: "#14110e", 2: "#1f1a15" },
        "on-dark": "#f6f2ea",
        brass: {
          DEFAULT: "#86622a",
          dark: "#6f4f13",
          50: "#faf7f1",
          100: "#f2e8d5",
          200: "#e6d3ad",
          300: "#d4b981",
          400: "#bfa05a",
          500: "#a3823c",
          600: "#86622a",
          700: "#6f4f13",
          800: "#5a4015",
          900: "#472f10",
        },
        // `primary` and `gold` are the accent ramps the app already references;
        // both now resolve to the brass accent so buttons/links read as one brand.
        primary: {
          50: "#faf7f1",
          100: "#f2e8d5",
          200: "#e6d3ad",
          300: "#d4b981",
          400: "#bfa05a",
          500: "#a3823c",
          600: "#86622a",
          700: "#6f4f13",
          800: "#5a4015",
          900: "#472f10",
        },
        gold: {
          50: "#faf7f1",
          100: "#f2e8d5",
          200: "#e6d3ad",
          300: "#d4b981",
          400: "#bfa05a",
          500: "#a3823c",
          600: "#86622a",
          700: "#6f4f13",
          800: "#5a4015",
          900: "#472f10",
        },
        // `dark` stays the espresso chrome ramp (header/footer/overlays) but its
        // mid steps now carry the ivory neutrals so they never fight the paper.
        dark: {
          50: "#f6f2ea",
          100: "#ece5d7",
          200: "#dcd2bd",
          300: "#c7bca3",
          400: "#a89c82",
          500: "#645a4b",
          600: "#4a4235",
          700: "#2f2a22",
          800: "#1f1a15",
          900: "#14110e",
          950: "#14110e",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        ui: ['Comfortaa', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}