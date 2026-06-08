/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        y2k: {
          bg:     '#080808',
          card:   '#111111',
          pink:   '#FF2D78',
          cyan:   '#00E5FF',
          lime:   '#CCFF00',
          purple: '#BF00FF',
          silver: '#C8C8D0',
          border: 'rgba(255,45,120,0.25)',
        },
      },
      boxShadow: {
        'neon-pink': '0 0 20px rgba(255,45,120,0.5), 0 0 40px rgba(255,45,120,0.2)',
        'neon-cyan': '0 0 20px rgba(0,229,255,0.5), 0 0 40px rgba(0,229,255,0.2)',
        'neon-sm':   '0 0 10px rgba(255,45,120,0.4)',
        'card':      '0 4px 24px rgba(0,0,0,0.8)',
      },
      animation: {
        'float':   'float 6s ease-in-out infinite',
        'float2':  'float 8s ease-in-out infinite reverse',
        'spin-slow':'spin 20s linear infinite',
        'pulse-pink':'pulse-pink 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        'pulse-pink': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(255,45,120,0.4)' },
          '50%':      { boxShadow: '0 0 25px rgba(255,45,120,0.8), 0 0 50px rgba(255,45,120,0.3)' },
        },
      },
    },
  },
  plugins: [],
}
