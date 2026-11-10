export interface Design { slug: string; title: string; summary: string; icon: string; tag: string }

export const designs: Design[] = [
  {
    slug: 'argocd',
    title: 'Argo CD architecture',
    summary: 'How Git, the API server, repo server, controller and cluster fit together, with animated request flows.',
    icon: '🐙',
    tag: 'GitOps',
  },
];
