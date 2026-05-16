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
  body: string; // headline — supports <b>…</b> and <br/>
  sub?: string; // supporting sentence — short, thin, calmer than the headline
};

type Seg = {
  kind: "video" | "pause";
  from: number; // frame at segment start
  to: number; // frame at segment end (small delta for pauses → creep)
  weight: number;
  momentId?: string;
};

export const MOMENTS: Moment[] = [
  {
    id: "m1",
    corner: "top-right",
    eyebrow: "I.",
    body: "THE <b>NEW EARTH</b><br/>REQUIRES NEW SPACES.",
    sub: "Humanity is entering a transition deeper than economic cycles or technological waves — a change in how reality itself is perceived and lived.",
  },
  {
    id: "m2",
    corner: "bottom-left",
    eyebrow: "II.",
    body: "ARCHITECTURE IS<br/><b>NOT NEUTRAL</b>.",
    sub: "Every environment we inhabit either supports human alignment or quietly works against it. Cocoon is designed for the first.",
  },
  {
    id: "m3",
    corner: "top-left",
    eyebrow: "III.",
    body: "SPACE SHAPES PERCEPTION.<br/>BEHAVIOR. <b>IDENTITY</b>.",
    sub: "Body, mind, and inner state are not separate systems — they are one continuous field. Cocoon treats them as such.",
  },
  {
    id: "m4",
    corner: "bottom-right",
    eyebrow: "IV.",
    body: "A <b>LIVING FIELD</b><br/>OF EXPERIENCE.",
    sub: "Movement, stillness, focus, and recovery coexist in one integrated environment — not a collection of disconnected programs.",
  },
  {
    id: "m5",
    corner: "center",
    eyebrow: "V.",
    body: "WHERE <b>POTENTIAL</b><br/>BECOMES FORM.",
    sub: "Cocoon is the infrastructure for an evolving humanity — a space designed for what you are becoming.",
  },
];

// Four-segment journey, 48fps motion-interpolated:
//   v1: frames   1-239 (exterior approach → entry → dome)
//   v2: frames 240-478 (dome → bamboo lattice → second chamber)
//   v3: frames 479-717 (over the lounge floor)
//   v4: frames 718-956 (pull back to reveal the grand dome interior — resolution)
const TOTAL_FRAMES = 956;
// Anchors aligned to story beats:
//   m1 — early v1, wide exterior approach
//   m2 — late v1, just past the door / entering the dome
//   m3 — mid v2, drifting through the bamboo lattice
//   m4 — start of v3, entering the intimate lounge space
//   m5 — late v3 / early v4, the resolution begins
const PAUSE_ANCHORS = [80, 190, 320, 500, 700];
const PAUSE_CREEP = 25;

const VIDEO_SPEED = 1.0;
const PAUSE_SPEED = 0.7;

export const SEGMENTS: Seg[] = (() => {
  const out: Seg[] = [];
  let prev = 0;
  PAUSE_ANCHORS.forEach((anchor, i) => {
    out.push({
      kind: "video",
      from: prev,
      to: anchor,
      weight: (anchor - prev) / VIDEO_SPEED,
    });
    out.push({
      kind: "pause",
      from: anchor,
      to: anchor + PAUSE_CREEP,
      weight: PAUSE_CREEP / PAUSE_SPEED,
      momentId: MOMENTS[i].id,
    });
    prev = anchor + PAUSE_CREEP;
  });
  // Final "rest" segment — holds at the last frame with extra scroll length so the
  // footer overlay has room to reveal cleanly. Weight is intentional, not derived.
  out.push({
    kind: "video",
    from: prev,
    to: TOTAL_FRAMES - 1,
    weight: 100,
  });
  return out;
})();

// Progress threshold at which the closing/footer overlay starts revealing.
// (Derived from the last segment's start position.)
export function footerOpacityFromProgress(p: number): number {
  // Last segment begins where everything before it ends.
  const lastIdx = SEGMENTS.length - 1;
  let accBefore = 0;
  for (let i = 0; i < lastIdx; i++) accBefore += SEGMENTS[i].weight;
  const totalWeight = accBefore + SEGMENTS[lastIdx].weight;
  const lastStart = accBefore / totalWeight;
  const lastEnd = 1;
  // Reveal between 25% and 75% of the last segment, then hold.
  const inSeg = (p - lastStart) / (lastEnd - lastStart);
  if (inSeg <= 0.25) return 0;
  if (inSeg >= 0.75) return 1;
  const t = (inSeg - 0.25) / 0.5;
  return 1 - Math.pow(1 - t, 3);
}

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
// Pause segments creep slowly (small from→to delta), video segments advance fully.
export function frameFromProgress(p: number): number {
  p = Math.max(0, Math.min(1, p));
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [s, e] = RANGES[i];
    if (p <= e) {
      const seg = SEGMENTS[i];
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
      // LINEAR travel bottom → top — moves at the same rate as the user scrolls
      const yFrac = 0.7 - t * 1.4;
      // Opacity edges only
      let opacity = 1;
      if (t < 0.06) opacity = t / 0.06;
      else if (t > 0.94) opacity = (1 - t) / 0.06;
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
