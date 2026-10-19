export interface Category {
  slug: 'how-to' | 'rnd' | 'issues' | 'commands' | 'k8s' | 'linux';
  title: string;
  nav: string;
  icon: string;
  tag: string;
  blurb: string;
  desc: string;
}

export const categories: Category[] = [
  { slug: 'how-to', title: 'How To', nav: 'How To', icon: '🧭', tag: 'Guides',
    blurb: 'Step-by-step playbooks for setting things up and shipping them.',
    desc: 'Playbooks for the recurring, procedural stuff. Open a card for the full guide.' },
  { slug: 'rnd', title: 'R&D', nav: 'R&D', icon: '🧪', tag: 'Notes',
    blurb: "Research notes, experiments, and ideas worth revisiting before they're forgotten.",
    desc: "Research notes, experiments, and ideas worth revisiting before they're forgotten." },
  { slug: 'issues', title: 'Issues & Solutions', nav: 'Issues', icon: '🩹', tag: 'Troubleshooting',
    blurb: 'A running log of problems that bit us once, and exactly how they got fixed.',
    desc: "Bugs, incidents, and the fixes that resolved them, so the next person doesn't start from zero." },
  { slug: 'commands', title: 'Frequent Commands', nav: 'Commands', icon: '⌘', tag: 'Reference',
    blurb: 'The commands typed often enough to deserve a permanent home.',
    desc: 'The commands that get typed often enough to earn a permanent spot here.' },
  { slug: 'k8s', title: 'K8s', nav: 'K8s', icon: '☸️', tag: 'Infra',
    blurb: 'Kubernetes cheatsheets, manifests, and debugging steps for a cluster having a bad day.',
    desc: 'Kubernetes reference: cluster ops, debugging, and manifests worth keeping around.' },
  { slug: 'linux', title: 'Linux', nav: 'Linux', icon: '🐧', tag: 'Systems',
    blurb: 'System-level tricks, permissions, networking, and the flags nobody remembers.',
    desc: 'System-level notes: permissions, networking, processes, and the flags worth remembering.' },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug)!;
export const indexOf = (slug: string) =>
  String(categories.findIndex((c) => c.slug === slug) + 1).padStart(2, '0');
