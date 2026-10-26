import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(['how-to', 'rnd', 'issues', 'commands', 'scripts', 'k8s', 'linux']),
    icon: z.string().default('📄'),
    tag: z.string().default('Guide'),
    order: z.number().default(100),
    meta: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  }),
});

export const collections = { guides };
