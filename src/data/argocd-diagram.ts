// Everything the interactive Argo CD architecture diagram needs. Edit text here, not in the page.

export interface DNode {
  id: string; x: number; y: number; w: number; h: number;
  title: string; sub: string; lines?: string[]; sublines?: string[];
  kind: 'ext' | 'comp' | 'opt';
}
export interface DLink { id: string; d: string; label: string; lx: number; ly: number; anchor?: 'start' | 'middle' | 'end'; dashed?: boolean; bi?: boolean; from: string; to: string }
export interface DInfo { name: string; tag: string; does: string; flow: string[]; talks: string[] }
export interface DStep { title: string; text: string; link?: string; dir?: 1 | -1 | 0; nodes: string[]; pulse?: string }
export interface DFlow { id: string; label: string; blurb: string; steps: DStep[] }

export const NODES: DNode[] = [
  { id: 'user', x: 20, y: 60, w: 170, h: 80, title: 'Users & CI', sub: 'UI · CLI · API', kind: 'ext' },
  { id: 'git', x: 20, y: 295, w: 170, h: 80, title: 'Git repository', sub: 'source of truth', kind: 'ext' },
  { id: 'dev', x: 20, y: 520, w: 170, h: 80, title: 'Developer', sub: 'git push', kind: 'ext' },
  { id: 'api', x: 540, y: 70, w: 200, h: 80, title: 'API Server', sub: 'argocd-server', kind: 'comp' },
  { id: 'dex', x: 840, y: 70, w: 200, h: 80, title: 'Dex / OIDC', sub: 'argocd-dex-server', kind: 'comp' },
  { id: 'repo', x: 270, y: 290, w: 190, h: 80, title: 'Repo Server', sub: 'argocd-repo-server', kind: 'comp' },
  { id: 'redis', x: 560, y: 290, w: 160, h: 80, title: 'Redis', sub: 'cache', kind: 'comp' },
  { id: 'ctrl', x: 820, y: 290, w: 200, h: 80, title: 'App Controller', sub: 'application-controller', kind: 'comp' },
  { id: 'cluster', x: 1130, y: 210, w: 130, h: 240, title: 'Target', sub: 'workloads run here', lines: ['Target', 'Kubernetes', 'cluster(s)'], sublines: ['workloads', 'run here'], kind: 'ext' },
  { id: 'appset', x: 300, y: 570, w: 210, h: 66, title: 'ApplicationSet', sub: 'optional', kind: 'opt' },
  { id: 'notif', x: 770, y: 570, w: 210, h: 66, title: 'Notifications', sub: 'optional', kind: 'opt' },
];

export const BOXES = [{ x: 240, y: 30, w: 860, h: 660, label: 'Argo CD · namespace argocd' }];

export const LINKS: DLink[] = [
  { id: 'user_api', from: 'user', to: 'api', d: 'M190,100 H540', label: 'HTTPS · gRPC / REST', lx: 365, ly: 88, anchor: 'middle' },
  { id: 'git_api', from: 'git', to: 'api', d: 'M190,310 H225 V135 H540', label: 'webhook (optional)', lx: 236, ly: 226, anchor: 'start', dashed: true },
  { id: 'api_dex', from: 'api', to: 'dex', d: 'M740,100 H840', label: 'OIDC', lx: 790, ly: 88, anchor: 'middle', bi: true },
  { id: 'api_repo', from: 'api', to: 'repo', d: 'M570,150 L400,290', label: 'get manifests', lx: 478, ly: 212, anchor: 'end' },
  { id: 'api_redis', from: 'api', to: 'redis', d: 'M640,150 V290', label: 'cached state', lx: 652, ly: 226, anchor: 'start' },
  { id: 'api_ctrl', from: 'api', to: 'ctrl', d: 'M710,150 L880,290', label: 'sync operation', lx: 808, ly: 212, anchor: 'start', dashed: true },
  { id: 'git_repo', from: 'git', to: 'repo', d: 'M190,335 H270', label: 'git fetch', lx: 230, ly: 322, anchor: 'middle', bi: true },
  { id: 'repo_redis', from: 'repo', to: 'redis', d: 'M460,330 H560', label: 'cache', lx: 510, ly: 318, anchor: 'middle' },
  { id: 'redis_ctrl', from: 'redis', to: 'ctrl', d: 'M720,330 H820', label: 'cache', lx: 770, ly: 318, anchor: 'middle', bi: true },
  { id: 'repo_ctrl', from: 'repo', to: 'ctrl', d: 'M365,370 C365,462 915,462 915,370', label: 'rendered manifests', lx: 640, ly: 458, anchor: 'middle' },
  { id: 'ctrl_cluster', from: 'ctrl', to: 'cluster', d: 'M1020,330 H1130', label: 'watch · apply', lx: 1075, ly: 318, anchor: 'middle', bi: true },
  { id: 'dev_git', from: 'dev', to: 'git', d: 'M105,520 V375', label: 'git push', lx: 118, ly: 452, anchor: 'start' },
];

export const INFO: Record<string, DInfo> = {
  user: {
    name: 'Users & CI', tag: 'External',
    does: 'People using the web UI or the argocd CLI, plus pipelines and scripts that call the Argo CD API.',
    flow: ['Out: HTTPS requests (gRPC or REST) to the API Server', 'In: application status, diffs and logs rendered back to them'],
    talks: ['API Server'],
  },
  git: {
    name: 'Git repository', tag: 'External · source of truth',
    does: 'Holds the desired state: plain YAML, Helm charts or Kustomize overlays. Whatever is committed here is what Argo CD makes the cluster look like.',
    flow: ['In: commits pushed by developers', 'Out: the Repo Server fetches it (polling about every 3 minutes by default)', 'Out (optional): a webhook tells the API Server something changed so it refreshes immediately'],
    talks: ['Developer', 'Repo Server', 'API Server'],
  },
  dev: {
    name: 'Developer', tag: 'External',
    does: 'Changes the desired state by committing to Git. Deploying never needs direct cluster credentials, because Argo CD pulls from Git.',
    flow: ['Out: git push / merged pull request to the repository'],
    talks: ['Git repository'],
  },
  api: {
    name: 'API Server', tag: 'argocd-server',
    does: 'The front door. Serves the gRPC/REST API behind the web UI and CLI, authenticates users (local accounts or SSO), enforces RBAC, manages repo and cluster credentials, and receives Git webhooks.',
    flow: ['In: UI, CLI and API calls · Git webhooks · SSO callbacks', 'Check: validates the session, then applies the RBAC policy', 'Out: reads cached state from Redis · asks the Repo Server for manifests · records sync operations on Application resources'],
    talks: ['Users & CI', 'Dex / OIDC', 'Repo Server', 'Redis', 'App Controller'],
  },
  dex: {
    name: 'Dex / OIDC', tag: 'argocd-dex-server · optional',
    does: 'A bundled OpenID Connect proxy that lets Argo CD sign users in through external identity providers (LDAP, SAML, GitHub, Microsoft and others). Argo CD can also talk to an OIDC provider directly via oidc.config, as in the Read-Only User guide with Azure AD.',
    flow: ['In: login redirect from the API Server', 'Out: sends the user to the identity provider and returns an ID token with identity and group claims'],
    talks: ['API Server'],
  },
  repo: {
    name: 'Repo Server', tag: 'argocd-repo-server',
    does: 'An internal service that keeps a local cache of Git repositories and turns them into final Kubernetes manifests (plain YAML, Helm, Kustomize or a plugin) for a given repo URL, revision and path. It never talks to your clusters.',
    flow: ['In: requests from the API Server (diff, preview) and the App Controller (desired state)', 'Work: git fetch, check out the revision, render the manifests', 'Out: returns the rendered manifests and caches them'],
    talks: ['Git repository', 'API Server', 'App Controller', 'Redis'],
  },
  redis: {
    name: 'Redis', tag: 'cache',
    does: 'A throw-away cache for cluster state and rendered manifests. It cuts the load on Git and the Kubernetes API. It is not the source of truth and can be lost and rebuilt without losing apps.',
    flow: ['In: live-state and manifest entries written by the Controller and Repo Server', 'Out: served to the API Server so the UI is fast'],
    talks: ['API Server', 'Repo Server', 'App Controller'],
  },
  ctrl: {
    name: 'Application Controller', tag: 'argocd-application-controller',
    does: 'The reconciler. A Kubernetes controller that continuously compares the live state of each Application with the desired state from the Repo Server, flags it OutOfSync on any difference, and performs syncs, self-heal and pruning, including hooks and sync waves.',
    flow: ['In: desired manifests from the Repo Server · live state watched from the cluster · sync operations from the API Server', 'Work: diff live vs desired, decide whether to sync', 'Out: applies changes to the cluster and reports health and sync status'],
    talks: ['Repo Server', 'Redis', 'Target cluster(s)', 'API Server'],
  },
  cluster: {
    name: 'Target Kubernetes cluster(s)', tag: 'External',
    does: 'Where your applications actually run. Argo CD manages the cluster it is installed in and any external clusters you register (for example with argocd cluster add).',
    flow: ['In: manifests applied by the Controller', 'Out: live resource state and events, watched by the Controller'],
    talks: ['App Controller'],
  },
  appset: {
    name: 'ApplicationSet controller', tag: 'optional',
    does: 'Generates many Application resources from one template and a generator (list, Git directories, clusters and more). Handy for multi-cluster or multi-environment rollouts.',
    flow: ['In: an ApplicationSet resource', 'Out: creates and updates Application resources, which the App Controller then reconciles'],
    talks: ['App Controller'],
  },
  notif: {
    name: 'Notifications controller', tag: 'optional',
    does: 'Watches Applications and sends alerts (Slack, email, webhooks and others) on events such as a failed sync or degraded health.',
    flow: ['In: Application status changes', 'Out: messages to your configured channels'],
    talks: ['App Controller'],
  },
};

export const FLOWS: DFlow[] = [
  {
    id: 'deploy', label: 'GitOps deploy', blurb: 'From a commit to running pods',
    steps: [
      { title: 'Push a change', link: 'dev_git', dir: 1, nodes: ['dev', 'git'], text: 'You merge a change to Helm values or manifests. Git is the single source of truth for what should be running.' },
      { title: 'Webhook (optional)', link: 'git_api', dir: 1, nodes: ['git', 'api'], text: 'Git can ping the API Server so Argo CD refreshes right away. Without a webhook it polls Git about every 3 minutes.' },
      { title: 'Fetch the repository', link: 'git_repo', dir: -1, nodes: ['git', 'repo'], text: 'The Repo Server clones or fetches the repo into its local cache and checks out the target revision.' },
      { title: 'Render the manifests', pulse: 'repo', nodes: ['repo'], text: 'It runs Helm, Kustomize, plain YAML or a plugin to produce the final Kubernetes manifests, and caches the result.' },
      { title: 'Hand over the desired state', link: 'repo_ctrl', dir: 1, nodes: ['repo', 'ctrl'], text: 'The Application Controller asks the Repo Server for the desired manifests of each Application.' },
      { title: 'Compare with live state', link: 'ctrl_cluster', dir: -1, nodes: ['ctrl', 'cluster', 'redis'], text: 'The Controller watches the target cluster (live state is cached in Redis) and diffs live against desired. Any difference means the app is OutOfSync.' },
      { title: 'Sync', link: 'ctrl_cluster', dir: 1, nodes: ['ctrl', 'cluster'], text: 'With auto-sync on, or when you click Sync, the Controller applies the difference: pre-sync hooks, resources in sync-wave order, then post-sync hooks.' },
      { title: 'Report health', link: 'redis_ctrl', dir: -1, nodes: ['ctrl', 'redis', 'api'], text: 'Sync and health status are recorded and served to the UI and CLI through the API Server. The app turns Synced and Healthy.' },
    ],
  },
  {
    id: 'ui', label: 'UI / CLI request', blurb: 'What happens when you click Sync',
    steps: [
      { title: 'You make a request', link: 'user_api', dir: 1, nodes: ['user', 'api'], text: 'You open the web UI, run the argocd CLI, or a pipeline calls the API.' },
      { title: 'Authenticate and authorize', pulse: 'api', nodes: ['api'], text: 'The API Server validates your session or token, then checks the RBAC policy (argocd-rbac-cm) for the action you asked for.' },
      { title: 'Read cached state', link: 'api_redis', dir: 1, nodes: ['api', 'redis'], text: 'Read-only requests are answered quickly from the cached application state.' },
      { title: 'Ask for manifests', link: 'api_repo', dir: 1, nodes: ['api', 'repo'], text: 'For diffs, previews and resource details the API Server asks the Repo Server for the rendered manifests.' },
      { title: 'Trigger the sync', link: 'api_ctrl', dir: 1, nodes: ['api', 'ctrl'], text: 'Clicking Sync records a sync operation on the Application resource, which the controller is watching.' },
      { title: 'Controller applies it', link: 'ctrl_cluster', dir: 1, nodes: ['ctrl', 'cluster'], text: 'The Application Controller picks up the operation and applies the manifests to the target cluster.' },
      { title: 'Status flows back', link: 'redis_ctrl', dir: -1, nodes: ['ctrl', 'redis', 'api', 'user'], text: 'Updated status is cached and served by the API Server, so your UI refreshes with the new sync and health state.' },
    ],
  },
  {
    id: 'heal', label: 'Self-heal (drift)', blurb: 'Someone edits the cluster by hand',
    steps: [
      { title: 'A manual change', pulse: 'cluster', nodes: ['cluster'], text: 'Someone changes a live resource directly, for example with kubectl edit or kubectl scale. Git no longer matches the cluster.' },
      { title: 'The controller notices', link: 'ctrl_cluster', dir: -1, nodes: ['ctrl', 'cluster'], text: 'The Application Controller is watching the cluster and sees the live object change.' },
      { title: 'Compare with Git', link: 'repo_ctrl', dir: 1, nodes: ['repo', 'ctrl'], text: 'It compares the live object with the desired manifest from the Repo Server (the cached render of Git).' },
      { title: 'OutOfSync', pulse: 'ctrl', nodes: ['ctrl'], text: 'They differ, so the Application is marked OutOfSync. With manual sync you would see this in the UI and decide what to do.' },
      { title: 'Heal', link: 'ctrl_cluster', dir: 1, nodes: ['ctrl', 'cluster'], text: 'With automated sync and selfHeal enabled, the Controller re-applies the Git version and the manual change is reverted. With prune on, resources deleted from Git are removed too.' },
    ],
  },
  {
    id: 'sso', label: 'SSO login', blurb: 'Sign in through your identity provider',
    steps: [
      { title: 'Log in with SSO', link: 'user_api', dir: 1, nodes: ['user', 'api'], text: 'You click Log in via SSO in the UI, or run argocd login --sso.' },
      { title: 'Redirect to the IdP', link: 'api_dex', dir: 1, nodes: ['api', 'dex'], text: 'The API Server sends you to the OIDC provider, through the bundled Dex or directly to your IdP such as Azure AD (oidc.config).' },
      { title: 'Token comes back', link: 'api_dex', dir: -1, nodes: ['api', 'dex'], text: 'After you authenticate, an ID token returns carrying your identity and group claims.' },
      { title: 'Map groups to roles', pulse: 'api', nodes: ['api'], text: 'The API Server maps your groups to roles using argocd-rbac-cm (policy.csv), for example role:admin or role:readonly.' },
      { title: 'Session established', link: 'user_api', dir: -1, nodes: ['api', 'user'], text: 'You get a session. Every later request carries it and is checked against RBAC before anything happens.' },
    ],
  },
];
