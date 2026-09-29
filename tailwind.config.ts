export default {
  theme: {
    extend: {
      colors: {
        primary: {
          700: 'var(--color-primary-700)',
          600: 'var(--color-primary-600)',
          100: 'var(--color-primary-100)'
        },
        neutral: {
          900: 'var(--color-neutral-900)',
          700: 'var(--color-neutral-700)',
          300: 'var(--color-neutral-300)',
          100: 'var(--color-neutral-100)',
          0: 'var(--color-neutral-0)'
        }
      },
      borderRadius: {
        card: 'var(--radius-card)',
        'bgn-sm': 'var(--radius-sm)',
        'bgn-xl': 'var(--radius-xl)',
        pill: 'var(--radius-pill)'
      }
    }
  }
}
