import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette Novae - tons neutres, crème, beige poudré, anthracite
        'novae-cream': '#FDFBF7',
        'novae-beige': '#E8D5C4',
        'novae-beige-light': '#F5EDE7',
        'novae-anthracite': '#2C2C2C',
        'novae-anthracite-light': '#4A4A4A',
        'novae-gold': '#D4A574',
        'novae-gold-light': '#E5B885',
      },
      fontFamily: {
        'serif': ['Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
