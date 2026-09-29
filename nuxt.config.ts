export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  css: [
    '~/design-tokens/bgn.tokens.css',
    '~/assets/css/main.css'
  ],
  app: {
    head: {
      title: 'TEST FE WITH DB',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: 'PostgreSQL 16 connectivity dashboard with three sample data tables.' },
        { name: 'theme-color', content: '#F9FBFD' }
      ]
    }
  },
  nitro: {
    preset: 'node-server',
    compressPublicAssets: true
  },
  routeRules: {
    '/**': {
      headers: {
        'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY'
      }
    }
  }
})
