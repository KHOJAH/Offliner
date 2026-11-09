/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./docs/stitch/**/*.html",
  ],
  darkMode: ['class', '[data-theme="dark"], [data-theme="monochrome"]'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        background: 'var(--bg-app)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-surface-elevated)',
          hover: 'var(--bg-surface-hover)',
          container: {
            lowest: 'var(--surface-container-lowest, #ffffff)',
            low: 'var(--surface-container-low, #f4f4f2)',
            DEFAULT: 'var(--surface-container, #eeeeec)',
            high: 'var(--surface-container-high, #e8e8e6)',
            highest: 'var(--surface-container-highest, #e2e3e1)',
          },
          dim: 'var(--surface-dim, #dadad8)',
          bright: 'var(--surface-bright, #f9f9f7)',
        },
        'surface-container-lowest': 'var(--surface-container-lowest, #ffffff)',
        'surface-container-low': 'var(--surface-container-low, #f4f4f2)',
        'surface-container': 'var(--surface-container, #eeeeec)',
        'surface-container-high': 'var(--surface-container-high, #e8e8e6)',
        'surface-container-highest': 'var(--surface-container-highest, #e2e3e1)',
        'surface-dim': 'var(--surface-dim, #dadad8)',
        'surface-bright': 'var(--surface-bright, #f9f9f7)',
        border: {
          subtle: 'var(--border-subtle)',
          hairline: 'var(--border-hairline)',
        },
        'border-subtle': 'var(--border-subtle)',
        'border-hairline': 'var(--border-hairline)',
        'outline-variant': 'var(--outline-variant, rgba(0, 0, 0, 0.08))',
        'secondary-container': 'var(--secondary-container, #e3e1ec)',
        'secondary-fixed-dim': 'var(--secondary-fixed-dim, #c6c5cf)',
        primary: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
          text: 'var(--accent-text)',
          container: 'var(--accent)',
        },
        'primary-container': 'var(--accent)',
        'on-primary': 'var(--accent-text)',
        'on-surface': 'var(--text-primary)',
        'on-surface-variant': 'var(--text-secondary)',
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        state: {
          success: 'var(--success)',
          warning: 'var(--warning)',
          error: 'var(--error)',
        },
        glass: {
          bg: 'var(--glass-bg)',
          border: 'var(--glass-border)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Inter"',
          '-system-ui',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      borderWidth: {
        'hairline': '0.5px',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        'apple-spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'apple-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'spring': '400ms',
      },
      scale: {
        '101': '1.01',
        '99': '0.99',
        '97': '0.97',
      },
      keyframes: {
        'modal-spring': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(12px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'dropdown-expand': {
          '0%': { opacity: '0', transform: 'scaleY(0.92) translateY(-6px)' },
          '100%': { opacity: '1', transform: 'scaleY(1) translateY(0)' },
        },
      },
      animation: {
        'modal-spring': 'modal-spring 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'dropdown-expand': 'dropdown-expand 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backdropBlur: {
        'glass': '20px',
      },
    },
  },
  plugins: [],
};
