import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'twilio-navy': '#000d25',
        'twilio-red': '#ef223a',
        'accent-1': '#babecc',
        'accent-2': '#7e869c',
        'accent-3': '#4d5777',
      },
      fontFamily: {
        heading: ['Tektur', 'sans-serif'],
        body: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
