import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Preem Brand Colors
        preem: {
          teal: {
            DEFAULT: '#17B3A6',
            50: '#E6F7F5',
            100: '#CCF0EC',
            200: '#99E1D9',
            300: '#66D2C6',
            400: '#33C3B3',
            500: '#17B3A6',
            600: '#128C82',
            700: '#0E6961',
            800: '#094641',
            900: '#052320',
          },
          navy: {
            DEFAULT: '#2C3E50',
            50: '#E8EBED',
            100: '#D1D7DB',
            200: '#A3AFB7',
            300: '#758793',
            400: '#475F6F',
            500: '#2C3E50',
            600: '#233240',
            700: '#1A2530',
            800: '#121920',
            900: '#090C10',
          },
          gold: {
            DEFAULT: '#F4C430',
            50: '#FEF9E7',
            100: '#FDF3CF',
            200: '#FBE79F',
            300: '#F9DB6F',
            400: '#F7CF3F',
            500: '#F4C430',
            600: '#C39D26',
            700: '#92761D',
            800: '#614E13',
            900: '#31270A',
          },
          purple: {
            DEFAULT: '#8B5CF6',
            50: '#F5F3FF',
            100: '#EDE9FE',
            200: '#DDD6FE',
            300: '#C4B5FD',
            400: '#A78BFA',
            500: '#8B5CF6',
            600: '#7C3AED',
            700: '#6D28D9',
            800: '#5B21B6',
            900: '#4C1D95',
          },
        },
        // System Colors (mapped to Preem palette)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
