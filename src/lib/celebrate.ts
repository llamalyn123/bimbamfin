/** Tiny confetti burst (no library). Skipped when the user prefers reduced motion. */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 3, count = 70) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  const colors = ['#D4A94F', '#7C3AED', '#10B981', '#F59E0B', '#4F46E5', '#EC4899'];
  const bits = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 7;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 3 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0], s: Math.random() * 6, life: 0 };
  });
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.vy += 0.25;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.s += 0.2;
      ctx.globalAlpha = Math.max(0, 1 - frame / 90);
      ctx.fillStyle = b.c;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.s);
      ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
      ctx.restore();
    }
    if (++frame < 90) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

const CHEERS = [
  'One down. Main character energy 💅',
  "Crushed it. Future you says thanks 🙏",
  'W secured 🏆',
  "Ticked off. You're on a roll 🔥",
  'Done and dusted ✨',
  "That's how it's done 😤",
  'Productivity era unlocked 📈',
  'Another one bites the dust 🎯'
];
const ALL_DONE = ["Day cleared. Go touch some grass 🌱", 'Everything ticked. Absolute legend 👑', 'Clean sweep today. Rest up 😌'];

export const cheer = (allDone = false) => {
  const list = allDone ? ALL_DONE : CHEERS;
  return list[(Math.random() * list.length) | 0];
};
