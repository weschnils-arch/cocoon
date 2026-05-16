// Story timeline — alternates between VIDEO (frame scrubs) and PAUSE (frame holds, text reveals).
// All scroll progress is allocated by segment weights so pacing is consistent regardless of pin length.

export type Corner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export type Moment = {
  id: string;
  corner: Corner;
  eyebrow?: string;
  body: string; // supports <b>…</b> and <br/>
};

type VideoSeg = {
  kind: "video";
  from: number; // frame
  to: number; // frame
  weight: number;
};
type PauseSeg = {
  kind: "pause";
  at: number; // held frame
  weight: number;
  momentId: string;
};
type Seg = VideoSeg | PauseSeg;

export const MOMENTS: Moment[] = [
  {
    id: "m1",
    corner: "top-right",
    eyebrow: "I.",
    body: "THE <b>NEW EARTH</b><br/>REQUIRES NEW SPACES.",
  },
  {
    id: "m2",
    corner: "bottom-left",
    eyebrow: "II.",
    body: "ARCHITECTURE IS<br/><b>NOT NEUTRAL</b>.",
  },
  {
    id: "m3",
    corner: "top-left",
    eyebrow: "III.",
    body: "SPACE SHAPES PERCEPTION.<br/>BEHAVIOR. <b>IDENTITY</b>.",
  },
  {
    id: "m4",
    corner: "bottom-right",
    eyebrow: "IV.",
    body: "A <b>LIVING FIELD</b><br/>OF EXPERIENCE.",
  },
  {
    id: "m5",
    corner: "center",
    eyebrow: "—",
    body: "INFRASTRUCTURE FOR AN<br/><b>EVOLVING HUMANITY</b>.",
  },
];

// Frame anchors split the 0..241 range into 6 video chunks + 5 pause points.
const TOTAL_FRAMES = 242;
const PAUSE_FRAMES = [40, 90, 135, 180, 220];

const VIDEO_WEIGHT = 1.4;
const PAUSE_WEIGHT = 1.1;

export const SEGMENTS: Seg[] = (() => {
  const out: Seg[] = [];
  let prev = 0;
  PAUSE_FRAMES.forEach((p, i) => {
    out.push({ kind: "video", from: prev, to: p, weight: VIDEO_WEIGHT });
    out.push({
      kind: "pause",
      at: p,
      weight: PAUSE_WEIGHT,
      momentId: MOMENTS[i].id,
    });
    prev = p;
  });
  // Final coast to the last frame
  out.push({ kind: "video", from: prev, to: TOTAL_FRAMES - 1, weight: 1.0 });
  return out;
})();

const TOTAL_WEIGHT = SEGMENTS.reduce((s, x) => s + x.weight, 0);

// Returns the normalized [start, end] progress for a segment index.
function segRange(index: number): [number, number] {
  let acc = 0;
  for (let i = 0; i < index; i++) acc += SEGMENTS[i].weight;
  const start = acc / TOTAL_WEIGHT;
  const end = (acc + SEGMENTS[index].weight) / TOTAL_WEIGHT;
  return [start, end];
}

// Pre-compute segment progress ranges (cheap, one-time).
const RANGES: [number, number][] = SEGMENTS.map((_, i) => segRange(i));

// Convert global scroll progress (0..1) to a fractional frame index.
export function frameFromProgress(p: number): number {
  p = Math.max(0, Math.min(1, p));
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [s, e] = RANGES[i];
    if (p <= e) {
      const seg = SEGMENTS[i];
      if (seg.kind === "pause") return seg.at;
      const t = (p - s) / Math.max(1e-6, e - s);
      return seg.from + t * (seg.to - seg.from);
    }
  }
  return TOTAL_FRAMES - 1;
}

// Visibility for a moment based on the progress range of its owning pause segment.
// Text TRAVELS from above-viewport (yFrac = -0.6) to below-viewport (+0.6)
// through the whole pause window. Opacity stays ~1 while in view, fades at the edges only.
export function momentState(
  momentId: string,
  p: number
): { opacity: number; yFrac: number } {
  for (let i = 0; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i];
    if (seg.kind === "pause" && seg.momentId === momentId) {
      const [s, e] = RANGES[i];
      if (p <= s) return { opacity: 0, yFrac: 0.7 };
      if (p >= e) return { opacity: 0, yFrac: -0.7 };
      const t = (p - s) / (e - s); // 0..1 within pause
      // Travel BOTTOM → TOP, eased so it lingers slightly mid-screen
      const eased = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const yFrac = 0.7 - eased * 1.4;
      // Opacity edges
      let opacity = 1;
      if (t < 0.08) opacity = t / 0.08;
      else if (t > 0.92) opacity = (1 - t) / 0.08;
      return { opacity, yFrac };
    }
  }
  return { opacity: 0, yFrac: 0 };
}

// Intro overlay fades during the very first video segment (before pause 1).
export function introOpacity(p: number): number {
  const [s, e] = RANGES[0]; // first segment is video 0
  // intro fully visible at p=0; gone by 60% of first video segment
  const cutoff = s + (e - s) * 0.6;
  if (p <= s) return 1;
  if (p >= cutoff) return 0;
  return 1 - (p - s) / (cutoff - s);
}

export function cornerClasses(corner: Corner): {
  position: string;
  align: string;
} {
  switch (corner) {
    case "top-left":
      return {
        position: "items-start justify-start pt-[18vh] pl-[6vw] md:pt-[20vh] md:pl-[8vw]",
        align: "items-start text-left",
      };
    case "top-right":
      return {
        position: "items-end justify-start pt-[18vh] pr-[6vw] md:pt-[20vh] md:pr-[8vw]",
        align: "items-end text-right",
      };
    case "bottom-left":
      return {
        position: "items-start justify-end pb-[18vh] pl-[6vw] md:pb-[20vh] md:pl-[8vw]",
        align: "items-start text-left",
      };
    case "bottom-right":
      return {
        position: "items-end justify-end pb-[18vh] pr-[6vw] md:pb-[20vh] md:pr-[8vw]",
        align: "items-end text-right",
      };
    default:
      return {
        position: "items-center justify-center px-6",
        align: "items-center text-center",
      };
  }
}
