import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    shikiConfig: { theme: 'github-dark', wrap: false },
  },
});
