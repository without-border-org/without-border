/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0eeff',
          100: '#e3deff',
          200: '#c9baff',
          300: '#a78bff',
          400: '#8b63ff',
          500: '#6C63FF',
          600: '#5348d4',
          700: '#3f32aa',
          800: '#2d2280',
          900: '#1e1657',
        },
        surface: {
          50:  '#f8f9ff',
          100: '#f0f1f8',
          800: '#22223a',
          850: '#1a1a2e',
          900: '#0f0f1a',
          950: '#080812',
        },
        accent: {
          pink: '#FF6584',
          violet: '#a78bfa',
          green: '#48BB78',
          amber: '#ECC94B',
          red: '#FC8181',
          teal: '#4FD1C5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.25s ease',
        'fade-in': 'fadeIn 0.2s ease',
        'pulse-slow': 'pulse 3s infinite',
        'slide-in-right': 'slideInRight 0.3s ease',
        'scale-in': 'scaleIn 0.2s ease',
        'glow': 'glow 2s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(108,99,255,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(108,99,255,0.6)' },
        },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(108, 99, 255, 0.3)',
        'glow-pink': '0 0 20px rgba(255, 101, 132, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
