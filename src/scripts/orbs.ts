// Thinking Orbs (https://libraries.dev/orbs) — driven by the library's framework-free engine, no React needed.
import { resolvePreset, MODE_FRAMES, paintFrame } from 'thinking-orbs/engine';
import type { OrbState } from 'thinking-orbs/engine';
// scaleCounts / scaleRadii: small helpers from thinking-orbs (MIT, © Jakub Antalik), copied here so the
// React-dependent root entry isn't pulled into the bundle.
const COUNT_PAIRS = [['latRings', 'lonDensity'], ['rings', 'lonDensity'], ['lanes', 'segs']];
const COUNT_KEYS = ['orbitN', 'ghostN', 'nodeN', 'strandN', 'signals'];
const RADIUS_KEYS = ['rBase', 'rDepth', 'rActive', 'rDot', 'ghostR', 'partR', 'partRDepth', 'nodeR', 'nodeRDepth'];
function scaleCounts(opts: any, scale: number) {
  const out = { ...opts }; const done = new Set<string>(); const rt = Math.sqrt(scale);
  for (const [a, b] of COUNT_PAIRS) {
    if (out[a] != null && out[b] != null && !done.has(a) && !done.has(b)) {
      out[a] = Math.max(2, Math.round(out[a] * rt)); out[b] = Math.max(2, Math.round(out[b] * rt)); done.add(a); done.add(b);
    }
  }
  for (const k of COUNT_KEYS) { const v = out[k]; if (v != null && v !== 0 && !done.has(k)) out[k] = Math.max(1, Math.round(v * scale)); }
  if (out.iconD != null) out.iconD = Math.max(0.02, out.iconD * scale);
  return out;
}
function scaleRadii(opts: any, scale: number) {
  const out = { ...opts };
  for (const k of RADIUS_KEYS) if (out[k] != null) out[k] = out[k] * scale;
  out.rSizeMul = (out.rSizeMul ?? 1) * scale;
  return out;
}


// Count/size multipliers of each state's 64px preset. Large orbs undo them to get the full-density design.
const P64: Record<string, [number, number]> = {
  working: [1, 1], searching: [0.42, 1.15], solving: [0.35, 1.05], listening: [0.341, 1], connecting: [1.35, 0.95],
  weaving: [0.5, 1], composing: [0.25, 0.85], breathing: [0.25, 0.956], shaping: [0.702, 1],
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface OrbHandle { setState(s: OrbState): void; destroy(): void }

export function mountOrb(canvas: HTMLCanvasElement, initial?: OrbState): OrbHandle {
  let state = (initial ?? (canvas.dataset.state as OrbState) ?? 'working') as OrbState;
  let size = 0, dpr = 1, speed = 1, opts: any, frameFn: any, ctx: CanvasRenderingContext2D | null = null;
  let raf = 0, running = false, visible = true, dead = false;

  function setup() {
    const s = canvas.offsetWidth; // layout size: unaffected by CSS transforms during the splash animation
    if (!s) return;
    size = s;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(s * dpr);
    canvas.height = Math.round(s * dpr);
    ctx = canvas.getContext('2d');
    const preset = s <= 26 ? 20 : s <= 48 ? 32 : 64;
    const r = resolvePreset(state, preset as 20 | 32 | 64);
    opts = r.opts;
    if (s > 96) {
      const [c, z] = P64[state] ?? [1, 1];
      opts = scaleRadii(scaleCounts(opts, 1 / c), 1 / z);
    }
    speed = r.speed;
    frameFn = MODE_FRAMES[r.mode];
  }
  function draw(t: number) {
    if (!ctx || !frameFn) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    paintFrame(ctx, frameFn(size, t, opts), true);
  }
  const tick = () => { draw((performance.now() / 1000) * speed); if (running) raf = requestAnimationFrame(tick); };
  const start = () => { if (running || reduce || dead) return; running = true; raf = requestAnimationFrame(tick); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  setup();
  draw(reduce ? 0.6 : (performance.now() / 1000) * speed);

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && document.visibilityState !== 'hidden') start(); else stop();
  });
  io.observe(canvas);
  const onVis = () => { if (document.visibilityState === 'hidden') stop(); else if (visible) start(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => {
    if (Math.abs(canvas.offsetWidth - size) > 2) { setup(); draw(reduce ? 0.6 : (performance.now() / 1000) * speed); }
  });
  ro.observe(canvas);

  const handle: OrbHandle = {
    setState(s) { state = s; setup(); draw(reduce ? 0.6 : (performance.now() / 1000) * speed); },
    destroy() { dead = true; stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); },
  };
  (canvas as any)._orb = handle;
  return handle;
}

export function mountAll() {
  const noSplash = document.documentElement.classList.contains('no-splash');
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-orb]').forEach((c) => {
    if (noSplash && c.closest('#splash')) return;
    mountOrb(c);
  });
}
