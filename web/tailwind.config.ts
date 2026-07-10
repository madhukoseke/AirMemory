import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      borderRadius: {
        card: 'var(--radius)',
        control: 'var(--radius-sm)'
      },
      colors: {
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        panel: 'var(--panel)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-strong': 'var(--accent-strong)',
        'accent-muted': 'var(--accent-muted)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        sidebar: 'var(--sidebar)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)'
        },
        graph: {
          pipeline: 'var(--graph-pipeline)',
          task: 'var(--graph-task)',
          table: 'var(--graph-table)',
          incident: 'var(--graph-incident)',
          resolution: 'var(--graph-resolution)'
        }
      },
      boxShadow: {
        glow: 'var(--glow)'
      }
    }
  },
  plugins: []
}

export default config
