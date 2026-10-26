import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    shikiConfig: { theme: 'synthwave-84', wrap: false },
  },
});
