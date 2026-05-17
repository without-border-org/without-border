/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — matches the functional mockup
        brand: {
          orange:       '#F97316',
          orangeHover:  '#EA580C',
          darkBg:       '#0E0E11',
          darkSidebar:  '#18181B',
          darkPanel:    '#27272A',
          darkBorder:   'rgba(255,255,255,0.06)',
          lightBg:      '#F3F3F6',
          lightSidebar: '#1B1442',
          lightPanel:   '#FFFFFF',
          lightBorder:  'rgba(15,15,30,0.08)',
        },
        // Legacy palette — kept for existing components not yet migrated
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
          pink:   '#FF6584',
          violet: '#a78bfa',
          green:  '#48BB78',
          amber:  '#ECC94B',
          red:    '#FC8181',
          teal:   '#4FD1C5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in-up':    'fadeInUp 0.25s ease',
        'fade-in':       'fadeIn 0.2s ease',
        'pulse-slow':    'pulse 3s infinite',
        'slide-in-right':'slideInRight 0.3s ease',
        'scale-in':      'scaleIn 0.2s ease',
      },
      keyframes: {
        fadeInUp:      { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:        { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInRight:  { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        scaleIn:       { '0%': { opacity: '0', transform: 'scale(0.9)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(108, 99, 255, 0.3)',
        'glow-orange':  '0 0 20px rgba(249, 115, 22, 0.3)',
        'glass':        '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  // Safelist for dynamically-constructed classes (getUserColor helper)
  safelist: [
    ...[
      'orange', 'blue', 'emerald', 'zinc', 'purple', 'violet', 'pink', 'teal',
    ].flatMap(c => [
      `bg-${c}-500`,
      `bg-${c}-500/10`, `bg-${c}-500/20`, `bg-${c}-500/30`,
      `text-${c}-500`,
      `border-${c}-500/10`, `border-${c}-500/20`, `border-${c}-500/30`,
    ]),
  ],
  plugins: [],
};
