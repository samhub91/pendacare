import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Disable automatic dark mode — Pendacare uses light mode only
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f4f9f1',
          100: '#e8f5e9',
          200: '#c8e6c9',
          500: '#4ca32e',
          600: '#388e3c',
          700: '#1b5e20',
        },
      },
    },
  },
  plugins: [],
}

export default config
