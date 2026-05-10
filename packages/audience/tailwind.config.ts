import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'twilio-navy': '#0D1B2A',
        'twilio-red': '#F22F46',
      },
    },
  },
  plugins: [],
} satisfies Config;
