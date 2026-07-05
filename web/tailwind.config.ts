import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'SFMono-Regular', 'ui-monospace', 'monospace']
      },
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        border: 'var(--border)',
        graph: {
          pipeline: 'var(--graph-pipeline)',
          task: 'var(--graph-task)',
          table: 'var(--graph-table)',
          incident: 'var(--graph-incident)',
          resolution: 'var(--graph-resolution)'
        }
      }
    }
  },
  plugins: []
}

export default config
