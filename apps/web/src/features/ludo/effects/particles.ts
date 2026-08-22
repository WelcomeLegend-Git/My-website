/**
 * Lightweight particle physics engine for Ludo Arena visual effects.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "rect" | "star";
  gravity: number;
  drag: number;
}

export type ParticlePreset = "capture" | "victory" | "six" | "finishToken" | "diceDust";

const PLAYER_COLORS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#eab308",
  green: "#22c55e",
};

const ALL_COLORS = Object.values(PLAYER_COLORS);

const rand = (min: number, max: number): number => Math.random() * (max - min) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const TAU = Math.PI * 2;

/* ---------- preset emitters ---------- */

const emitCapture = (x: number, y: number, color?: string): Particle[] => {
  const c = color && PLAYER_COLORS[color] ? PLAYER_COLORS[color] : "#ef4444";
  const particles: Particle[] = [];
  for (let i = 0; i < 32; i++) {
    const angle = rand(0, TAU);
    const speed = rand(120, 340);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(0.5, 0.8),
      size: rand(3, 7),
      color: i % 4 === 0 ? "#fff" : c,
      rotation: rand(0, TAU),
      rotationSpeed: rand(-8, 8),
      shape: i % 3 === 0 ? "star" : "circle",
      gravity: 280,
      drag: 0.97,
    });
  }
  return particles;
};

const emitVictory = (canvasW: number): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < 90; i++) {
    particles.push({
      x: rand(0, canvasW),
      y: rand(-40, -200),
      vx: rand(-60, 60),
      vy: rand(90, 260),
      life: 1, maxLife: rand(2.5, 4),
      size: rand(4, 9),
      color: pick(ALL_COLORS),
      rotation: rand(0, TAU),
      rotationSpeed: rand(-6, 6),
      shape: "rect",
      gravity: 50,
      drag: 0.995,
    });
  }
  return particles;
};

const emitSix = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < 22; i++) {
    const angle = rand(0, TAU);
    const speed = rand(80, 220);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      life: 1, maxLife: rand(0.3, 0.55),
      size: rand(2, 5),
      color: pick(["#fbbf24", "#fde68a", "#fff", "#f59e0b"]),
      rotation: rand(0, TAU),
      rotationSpeed: rand(-10, 10),
      shape: "star",
      gravity: 60,
      drag: 0.96,
    });
  }
  return particles;
};

const emitFinishToken = (x: number, y: number, color?: string): Particle[] => {
  const c = color && PLAYER_COLORS[color] ? PLAYER_COLORS[color] : "#eab308";
  const particles: Particle[] = [];
  for (let i = 0; i < 18; i++) {
    particles.push({
      x: x + rand(-8, 8),
      y,
      vx: rand(-40, 40),
      vy: rand(-220, -80),
      life: 1, maxLife: rand(0.4, 0.7),
      size: rand(2, 5),
      color: i % 3 === 0 ? "#fff" : c,
      rotation: rand(0, TAU),
      rotationSpeed: rand(-5, 5),
      shape: i % 2 === 0 ? "star" : "circle",
      gravity: 20,
      drag: 0.98,
    });
  }
  return particles;
};

const emitDiceDust = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = rand(0, TAU);
    const speed = rand(30, 80);
    particles.push({
      x: x + rand(-12, 12),
      y: y + rand(-8, 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(0.15, 0.3),
      size: rand(2, 4),
      color: pick(["#a0855b", "#c4a35a", "#8b6914", "#d4b87a"]),
      rotation: 0,
      rotationSpeed: 0,
      shape: "circle",
      gravity: 0,
      drag: 0.92,
    });
  }
  return particles;
};

/* ---------- public API ---------- */

export const emitParticles = (
  preset: ParticlePreset,
  origin: { x: number; y: number },
  canvasSize: { w: number; h: number },
  color?: string,
): Particle[] => {
  switch (preset) {
    case "capture": return emitCapture(origin.x, origin.y, color);
    case "victory": return emitVictory(canvasSize.w);
    case "six": return emitSix(origin.x, origin.y);
    case "finishToken": return emitFinishToken(origin.x, origin.y, color);
    case "diceDust": return emitDiceDust(origin.x, origin.y);
  }
};

export const updateParticle = (p: Particle, dt: number): boolean => {
  p.life -= dt / p.maxLife;
  if (p.life <= 0) return false;
  p.vy += p.gravity * dt;
  p.vx *= p.drag;
  p.vy *= p.drag;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rotation += p.rotationSpeed * dt;
  return true;
};

const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void => {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const method = i === 0 ? "moveTo" : "lineTo";
    ctx[method](cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
};

export const renderParticle = (ctx: CanvasRenderingContext2D, p: Particle): void => {
  const alpha = Math.max(0, p.life);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = p.color;
  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, TAU);
    ctx.fill();
  } else if (p.shape === "rect") {
    ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
  } else {
    drawStar(ctx, 0, 0, p.size);
  }
  ctx.restore();
};
