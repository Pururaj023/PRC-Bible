import type { DNode, DLink, DInfo, DFlow } from './argocd-diagram';

export const BOXES = [
  { x: 240, y: 20, w: 860, h: 280, label: 'Control plane' },
  { x: 240, y: 370, w: 860, h: 330, label: 'Worker node · one of many' },
];

export const NODES: DNode[] = [
  { id: 'kubectl', x: 20, y: 190, w: 170, h: 76, title: 'kubectl · CI', sub: 'you, pipelines', kind: 'ext' },
  { id: 'registry', x: 20, y: 420, w: 170, h: 76, title: 'Image registry', sub: 'ACR · Docker Hub', kind: 'ext' },
  { id: 'etcd', x: 270, y: 60, w: 190, h: 76, title: 'etcd', sub: 'cluster database', kind: 'comp' },
  { id: 'sched', x: 515, y: 60, w: 190, h: 76, title: 'Scheduler', sub: 'kube-scheduler', kind: 'comp' },
  { id: 'cm', x: 760, y: 60, w: 190, h: 76, title: 'Controllers', sub: 'controller-manager', kind: 'comp' },
  { id: 'api', x: 510, y: 190, w: 200, h: 76, title: 'API Server', sub: 'kube-apiserver', kind: 'comp' },
  { id: 'cloud', x: 880, y: 190, w: 200, h: 76, title: 'Cloud Controller', sub: 'optional', kind: 'opt' },
  { id: 'runtime', x: 270, y: 420, w: 190, h: 76, title: 'Runtime', sub: 'containerd', kind: 'comp' },
  { id: 'kubelet', x: 510, y: 420, w: 200, h: 76, title: 'kubelet', sub: 'node agent', kind: 'comp' },
  { id: 'proxy', x: 760, y: 420, w: 190, h: 76, title: 'kube-proxy', sub: 'Service networking', kind: 'comp' },
  { id: 'pods', x: 440, y: 590, w: 340, h: 80, title: 'Pods', sub: 'your containers run here', kind: 'comp' },
  { id: 'lb', x: 1130, y: 420, w: 130, h: 76, title: 'Load', sub: '', lines: ['Load', 'balancer'], kind: 'ext' },
  { id: 'client', x: 1130, y: 600, w: 130, h: 76, title: 'Client', sub: 'browser · app', kind: 'ext' },
];

export const LINKS: DLink[] = [
  { id: 'kctl_api', from: 'kubectl', to: 'api', d: 'M190,228 H510', label: 'kubectl · REST', lx: 350, ly: 216, anchor: 'middle' },
  { id: 'etcd_api', from: 'etcd', to: 'api', d: 'M365,136 L520,196', label: 'state', lx: 452, ly: 160, anchor: 'middle', bi: true },
  { id: 'sched_api', from: 'sched', to: 'api', d: 'M610,136 V190', label: 'Pods to place', lx: 622, ly: 168, anchor: 'start', bi: true },
  { id: 'cm_api', from: 'cm', to: 'api', d: 'M790,136 L690,190', label: 'watch · create', lx: 776, ly: 180, anchor: 'start', bi: true },
  { id: 'cloud_api', from: 'cloud', to: 'api', d: 'M880,228 H710', label: 'cloud APIs', lx: 795, ly: 216, anchor: 'middle', dashed: true },
  { id: 'api_kubelet', from: 'api', to: 'kubelet', d: 'M610,266 V420', label: 'watch Pods · report', lx: 622, ly: 345, anchor: 'start', bi: true },
  { id: 'api_proxy', from: 'api', to: 'proxy', d: 'M680,266 L830,420', label: 'Services', lx: 792, ly: 344, anchor: 'start' },
  { id: 'kubelet_runtime', from: 'kubelet', to: 'runtime', d: 'M510,458 H460', label: 'CRI', lx: 485, ly: 446, anchor: 'middle' },
  { id: 'runtime_registry', from: 'runtime', to: 'registry', d: 'M270,458 H190', label: 'pull', lx: 230, ly: 446, anchor: 'middle' },
  { id: 'runtime_pods', from: 'runtime', to: 'pods', d: 'M365,496 V630 H440', label: 'run containers', lx: 378, ly: 560, anchor: 'start' },
  { id: 'kubelet_pods', from: 'kubelet', to: 'pods', d: 'M610,496 V590', label: 'probes · status', lx: 622, ly: 548, anchor: 'start', bi: true },
  { id: 'proxy_pods', from: 'proxy', to: 'pods', d: 'M855,496 V630 H780', label: 'routes traffic', lx: 868, ly: 560, anchor: 'start' },
  { id: 'lb_proxy', from: 'lb', to: 'proxy', d: 'M1130,458 H950', label: 'NodePort / LB', lx: 1040, ly: 446, anchor: 'middle' },
  { id: 'client_lb', from: 'client', to: 'lb', d: 'M1195,600 V496', label: 'HTTP', lx: 1207, ly: 556, anchor: 'start' },
];

export const INFO: Record<string, DInfo> = {
  kubectl: {
    name: 'kubectl · CI', tag: 'External',
    does: 'The command-line client you use every day, plus CI/CD pipelines, dashboards and tools like Argo CD. They are all just clients of the same REST API: nothing talks to the cluster except through the API server.',
    flow: ['Out: HTTPS requests to the API Server (get, apply, delete, logs, exec)', 'In: the object or result you asked for'],
    talks: ['API Server'],
  },
  registry: {
    name: 'Image registry', tag: 'External',
    does: 'Stores your container images (Azure Container Registry, Docker Hub and so on). Nodes pull images from here when a Pod starts. The control plane never touches images.',
    flow: ['In: image pull requests from the Runtime on each node', 'Out: image layers, which the node caches locally'],
    talks: ['Runtime'],
  },
  etcd: {
    name: 'etcd', tag: 'Control plane · the database',
    does: 'A consistent key-value store that holds the entire cluster state: every Deployment, Pod, Secret and ConfigMap. Only the API Server talks to it. If you lose etcd you lose the cluster\'s memory, which is why it is backed up. On AKS, Azure runs and protects it for you.',
    flow: ['In: writes from the API Server whenever an object is created or changed', 'Out: reads and change notifications back to the API Server'],
    talks: ['API Server'],
  },
  sched: {
    name: 'Scheduler', tag: 'kube-scheduler',
    does: 'Picks a node for every new Pod. It first filters out nodes that cannot run the Pod (not enough CPU or memory, taints, affinity rules), then scores the rest and chooses the best. It only decides; the kubelet does the running.',
    flow: ['In: Pods that have no node yet (watched through the API Server)', 'Work: filter nodes, score nodes, pick one', 'Out: writes the chosen node name onto the Pod (a binding)'],
    talks: ['API Server'],
  },
  cm: {
    name: 'Controller Manager', tag: 'kube-controller-manager',
    does: 'Runs the control loops that make reality match what you asked for. The Deployment controller creates ReplicaSets, the ReplicaSet controller creates Pods, the Node controller reacts to dead nodes, the Job controller runs batch work, and the HPA controller scales replicas.',
    flow: ['In: watches objects through the API Server (desired state)', 'Work: compares desired with actual state, one loop per object type', 'Out: creates, updates or deletes objects to close the gap'],
    talks: ['API Server'],
  },
  api: {
    name: 'API Server', tag: 'kube-apiserver',
    does: 'The front door and the hub of the cluster. It serves the REST API, authenticates you, checks permissions with RBAC, runs admission controllers, validates objects, saves them to etcd, and notifies anyone watching for changes. Every other component talks through it, never to each other.',
    flow: ['In: requests from kubectl, controllers, the scheduler and every kubelet', 'Check: authentication, then authorization (RBAC), then admission', 'Out: reads and writes etcd and streams change events to watchers'],
    talks: ['kubectl · CI', 'etcd', 'Scheduler', 'Controller Manager', 'kubelet', 'kube-proxy', 'Cloud Controller'],
  },
  cloud: {
    name: 'Cloud Controller', tag: 'cloud-controller-manager · optional',
    does: 'Present on cloud clusters. It talks to the cloud provider\'s API to create load balancers for Services, manage node lifecycle and set up routes. On AKS, Azure runs it as part of the managed control plane.',
    flow: ['In: Service of type LoadBalancer, new or removed nodes (via the API Server)', 'Out: calls the cloud API to create or delete the load balancer and routes'],
    talks: ['API Server', 'Load balancer'],
  },
  runtime: {
    name: 'Container runtime', tag: 'containerd · on every node',
    does: 'The software that actually pulls images and runs containers, spoken to through the Container Runtime Interface (CRI). containerd is the common choice and the one AKS uses.',
    flow: ['In: instructions from the kubelet (start, stop, inspect containers)', 'Work: pull the image from the registry, create the container', 'Out: running containers inside the Pod'],
    talks: ['kubelet', 'Image registry', 'Pods'],
  },
  kubelet: {
    name: 'kubelet', tag: 'Agent on every node',
    does: 'The node\'s own manager. It watches the API Server for Pods assigned to its node, tells the runtime to start them, mounts volumes, runs liveness and readiness probes, restarts failed containers, and reports Pod and node status back.',
    flow: ['In: Pods bound to this node (from the API Server)', 'Work: start containers through the runtime, run probes', 'Out: status and health reports to the API Server'],
    talks: ['API Server', 'Runtime', 'Pods'],
  },
  proxy: {
    name: 'kube-proxy', tag: 'Service networking · on every node',
    does: 'Keeps network rules (iptables or IPVS) up to date so that a Service\'s stable virtual IP reaches one of its healthy Pods. It watches Services and their endpoints through the API Server. Some network plugins take over this job.',
    flow: ['In: Service and endpoint changes from the API Server · traffic arriving at the node', 'Work: pick a healthy Pod behind the Service and rewrite the destination to its IP', 'Out: forwards the packet to that Pod'],
    talks: ['API Server', 'Pods', 'Load balancer'],
  },
  pods: {
    name: 'Pods', tag: 'Your workload',
    does: 'The smallest thing Kubernetes runs: one or more containers sharing one IP address and optional volumes. Pods are disposable. When one dies, a controller creates a replacement rather than fixing it. A network (CNI) plugin gives each Pod its IP.',
    flow: ['In: traffic from kube-proxy or other Pods · start and stop commands via the runtime', 'Work: your application code runs', 'Out: responses, logs and health (probes) to the kubelet'],
    talks: ['Runtime', 'kubelet', 'kube-proxy'],
  },
  lb: {
    name: 'Load balancer', tag: 'External',
    does: 'A cloud load balancer created for a Service of type LoadBalancer, or in front of an Ingress controller. It sends traffic from outside into the cluster\'s nodes.',
    flow: ['In: requests from clients on the internet or your network', 'Out: forwards to a node port, where kube-proxy takes over'],
    talks: ['Client', 'kube-proxy', 'Cloud Controller'],
  },
  client: {
    name: 'Client', tag: 'External',
    does: 'A user, browser or another application outside the cluster that wants to reach your app.',
    flow: ['Out: HTTP or TCP request to the load balancer', 'In: the response from your Pod'],
    talks: ['Load balancer'],
  },
};

export const FLOWS: DFlow[] = [
  {
    id: 'deploy', label: 'Deploy an app', blurb: 'From kubectl apply to a running Pod',
    steps: [
      { title: 'You run kubectl apply', link: 'kctl_api', dir: 1, nodes: ['kubectl', 'api'], text: 'You hand Kubernetes a Deployment manifest saying "run 3 copies of this image". kubectl sends it to the API server.' },
      { title: 'The front door checks it', pulse: 'api', nodes: ['api'], text: 'The API server authenticates you, checks RBAC to see you may create Deployments, runs admission controllers (which can validate or change the object), then accepts it.' },
      { title: 'Saved in etcd', link: 'etcd_api', dir: -1, nodes: ['api', 'etcd'], text: 'The Deployment is stored in etcd. That is the "desired state". Nothing is running yet.' },
      { title: 'Controllers create the Pods', link: 'cm_api', dir: 1, nodes: ['cm', 'api'], text: 'The Deployment controller creates a ReplicaSet, and the ReplicaSet controller creates 3 Pod objects. They exist on paper, but have no node.' },
      { title: 'The scheduler picks nodes', link: 'sched_api', dir: 1, nodes: ['sched', 'api'], text: 'The scheduler sees Pods with no node, filters out nodes that cannot fit them, scores the rest, and records its choice on each Pod.' },
      { title: 'The kubelet notices', link: 'api_kubelet', dir: 1, nodes: ['api', 'kubelet'], text: 'The kubelet on the chosen node is watching the API server and sees a new Pod assigned to it.' },
      { title: 'Runtime pulls the image', link: 'runtime_registry', dir: 1, nodes: ['kubelet', 'runtime', 'registry'], text: 'The kubelet tells the container runtime to start the containers. The runtime pulls the image from the registry first.' },
      { title: 'Containers start', link: 'runtime_pods', dir: 1, nodes: ['runtime', 'pods'], text: 'The runtime creates the containers. The network plugin gives the Pod an IP address and volumes are mounted.' },
      { title: 'Status reported back', link: 'api_kubelet', dir: -1, nodes: ['kubelet', 'api', 'etcd'], text: 'The kubelet reports the Pod as Running. The API server stores that in etcd, and kubectl get pods now shows it.' },
    ],
  },
  {
    id: 'traffic', label: 'Request to your app', blurb: 'How a user reaches a Pod',
    steps: [
      { title: 'A user makes a request', link: 'client_lb', dir: 1, nodes: ['client', 'lb'], text: 'A browser or app calls your service. The request hits the cloud load balancer created for your Service or Ingress.' },
      { title: 'On to a node', link: 'lb_proxy', dir: 1, nodes: ['lb', 'proxy'], text: 'The load balancer forwards the traffic to one of the cluster\'s nodes, where kube-proxy is waiting.' },
      { title: 'Pick a healthy Pod', pulse: 'proxy', nodes: ['proxy'], text: 'kube-proxy has network rules (iptables or IPVS) for each Service. They choose one healthy Pod behind the Service and point the packet at that Pod\'s IP.' },
      { title: 'Forward to the Pod', link: 'proxy_pods', dir: 1, nodes: ['proxy', 'pods'], text: 'The packet goes to the chosen Pod, over the cluster network if the Pod lives on another node.' },
      { title: 'Your app answers', pulse: 'pods', nodes: ['pods'], text: 'Your container handles the request and the response travels back along the same path to the user.' },
      { title: 'Routes stay fresh', link: 'api_proxy', dir: 1, nodes: ['api', 'proxy'], text: 'In the background, kube-proxy watches the API server for Services and endpoints, so its rules update as Pods are added or removed.' },
    ],
  },
  {
    id: 'heal', label: 'Self-healing', blurb: 'What happens when a Pod dies',
    steps: [
      { title: 'A container crashes', pulse: 'pods', nodes: ['pods'], text: 'The process in a container exits, or a liveness probe keeps failing. Something is wrong inside a Pod.' },
      { title: 'kubelet restarts it', link: 'kubelet_pods', dir: -1, nodes: ['pods', 'kubelet', 'runtime'], text: 'The kubelet notices first and restarts the container on the same node. This is the first line of defence, and what causes the restart count and CrashLoopBackOff you see.' },
      { title: 'Status is reported', link: 'api_kubelet', dir: -1, nodes: ['kubelet', 'api'], text: 'The kubelet reports the Pod\'s state to the API server. If the whole node dies, the node controller marks it NotReady after a timeout.' },
      { title: 'Desired vs actual', link: 'cm_api', dir: -1, nodes: ['api', 'cm'], text: 'The ReplicaSet controller compares what you asked for (3 replicas) with what exists (2). They differ.' },
      { title: 'A replacement is made', link: 'sched_api', dir: 1, nodes: ['cm', 'sched', 'api'], text: 'It creates a new Pod object, and the scheduler places it on a healthy node.' },
      { title: 'Back to normal', link: 'api_kubelet', dir: 1, nodes: ['api', 'kubelet', 'pods'], text: 'That node\'s kubelet starts the replacement. Desired and actual match again, and nobody had to log in.' },
    ],
  },
  {
    id: 'scale', label: 'Autoscaling', blurb: 'How replicas grow under load',
    steps: [
      { title: 'Load goes up', pulse: 'pods', nodes: ['pods'], text: 'Traffic grows and your Pods start using more CPU or memory.' },
      { title: 'Metrics are collected', link: 'api_kubelet', dir: -1, nodes: ['kubelet', 'api'], text: 'Each kubelet exposes resource usage. Metrics Server gathers it and serves it through the API server as metrics.k8s.io.' },
      { title: 'HPA reads the numbers', link: 'cm_api', dir: -1, nodes: ['api', 'cm'], text: 'The Horizontal Pod Autoscaler controller, which lives in the controller manager, checks usage about every 15 seconds and compares it with your target, for example 70% CPU.' },
      { title: 'Replica count rises', link: 'cm_api', dir: 1, nodes: ['cm', 'api'], text: 'If usage is above target, it raises the Deployment\'s replica count within your min and max limits. Tools like KEDA can drive this from queue lag instead of CPU.' },
      { title: 'New Pods are scheduled', link: 'sched_api', dir: 1, nodes: ['sched', 'api'], text: 'The new Pods are placed on nodes. If no node has room they sit Pending, and a cluster autoscaler can add nodes.' },
      { title: 'Load is spread out', link: 'api_kubelet', dir: 1, nodes: ['api', 'kubelet', 'pods'], text: 'The kubelets start the extra Pods and the Service spreads traffic across all of them.' },
    ],
  },
];
