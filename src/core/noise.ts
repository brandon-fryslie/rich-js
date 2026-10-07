/**
 * Gradient noise, the texture every effect in `renderables/effects` is drawn
 * from. Ken Perlin's improved noise (2002): a smooth pseudo-random
 * field over space and time, continuous in its first and second derivatives,
 * so a cell sampled a moment later has moved a little, never jumped. Things
 * the eye knows as alive — water, wind, breath, a glow — vary like this:
 * coherent nearby, uncorrelated far apart, never repeating exactly.
 *
 * [LAW:no-ambient-temporal-coupling] A pure function of its coordinates; time
 * is one of them. The permutation is fixed, so a moment draws the same frame
 * on every run.
 *
 * Tier 0 of `src/core/`: imports nothing. Not part of the package's surface;
 * the effects playground reaches it as source.
 */

/** Ken Perlin's reference permutation, doubled so a lookup never wraps. */
const P = (() => {
  const base = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10,
    23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87,
    174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211,
    133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
    89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5,
    202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119,
    248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
    178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249,
    14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205,
    93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  return [...base, ...base];
})();

/** Quintic smoothstep: zero first and second derivative at 0 and 1. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

/** The dot of one of twelve edge gradients, picked by `hash`, with (x, y, z). */
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Noise at (x, y, z), in about [-1, 1]; zero at every integer lattice point. */
export function noise(x: number, y: number, z: number): number {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);
  const X = fx & 255;
  const Y = fy & 255;
  const Z = fz & 255;
  x -= fx;
  y -= fy;
  z -= fz;
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = P[X]! + Y;
  const AA = P[A]! + Z;
  const AB = P[A + 1]! + Z;
  const B = P[X + 1]! + Y;
  const BA = P[B]! + Z;
  const BB = P[B + 1]! + Z;
  return lerp(
    lerp(lerp(grad(P[AA]!, x, y, z), grad(P[BA]!, x - 1, y, z), u), lerp(grad(P[AB]!, x, y - 1, z), grad(P[BB]!, x - 1, y - 1, z), u), v),
    lerp(
      lerp(grad(P[AA + 1]!, x, y, z - 1), grad(P[BA + 1]!, x - 1, y, z - 1), u),
      lerp(grad(P[AB + 1]!, x, y - 1, z - 1), grad(P[BB + 1]!, x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}

/**
 * Fractal Brownian motion: `octaves` layers of noise, each twice the
 * frequency and half the amplitude of the last, scaled back into about
 * [-1, 1]. One layer is a soft swell; three is a swell with detail on it.
 */
export function fbm(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    const f = 2 ** i;
    sum += amplitude * noise(x * f, y * f, z * f);
    total += amplitude;
    amplitude /= 2;
  }
  return sum / total;
}

/**
 * A pseudo-random number in [0, 1) for the `n`th of something — a breath, a
 * gust — uncorrelated with the `n ± 1`th, where `noise` would make
 * neighbours alike. The classic shader hash: the fraction of a large sine.
 */
export function hash(n: number, z: number): number {
  const x = Math.sin(n * 12.9898 + z * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Hermite smoothstep from `a` to `b`, clamped to [0, 1]. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
