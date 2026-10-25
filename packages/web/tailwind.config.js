/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        status: {
          fresh: {
            fg: 'var(--status-fresh-fg)',
            bg: 'var(--status-fresh-bg)',
          },
          drifted: {
            fg: 'var(--status-drifted-fg)',
            bg: 'var(--status-drifted-bg)',
          },
          outdated: {
            fg: 'var(--status-outdated-fg)',
            bg: 'var(--status-outdated-bg)',
          },
          affected: {
            fg: 'var(--status-affected-fg)',
            bg: 'var(--status-affected-bg)',
          },
          unknown: {
            fg: 'var(--status-unknown-fg)',
            bg: 'var(--status-unknown-bg)',
          },
          error: {
            fg: 'var(--status-error-fg)',
            bg: 'var(--status-error-bg)',
          },
        },
        agent: {
          coral: 'var(--agent-coral)',
          green: 'var(--agent-green)',
          violet: 'var(--agent-violet)',
          amber: 'var(--agent-amber)',
          cyan: 'var(--agent-cyan)',
          magenta: 'var(--agent-magenta)',
        },
      },
      fontFamily: {
        ui: ['var(--font-ui)'],
        code: ['var(--font-code)'],
      },
      borderRadius: {
        control: '6px',
        card: '10px',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        DEFAULT: 'var(--dur)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)',
      },
    },
  },
  plugins: [],
};
