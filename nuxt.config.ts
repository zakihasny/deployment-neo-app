export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  ssr: false,
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
        { name: 'description', content: 'Static front-end dashboard with three browser-generated sample data tables.' },
        { name: 'theme-color', content: '#F9FBFD' }
      ]
    }
  },
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/']
    }
  }
})
