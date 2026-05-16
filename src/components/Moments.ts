// Scroll-keyed text moments — pulled from the COCOON project PDF.

export type Corner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export type Moment = {
  id: string;
  start: number; // begin fade-in
  peak: number; // fully visible from here
  fade: number; // begin fade-out
  end: number; // fully gone
  corner: Corner;
  eyebrow?: string;
  body: string; // supports <b>…</b> and <br/>
};

export const MOMENTS: Moment[] = [
  {
    id: "m1",
    start: 0.13,
    peak: 0.2,
    fade: 0.27,
    end: 0.33,
    corner: "top-right",
    eyebrow: "I.",
    body: "THE <b>NEW EARTH</b><br/>REQUIRES NEW SPACES.",
  },
  {
    id: "m2",
    start: 0.33,
    peak: 0.4,
    fade: 0.47,
    end: 0.53,
    corner: "bottom-left",
    eyebrow: "II.",
    body: "ARCHITECTURE IS<br/><b>NOT NEUTRAL</b>.",
  },
  {
    id: "m3",
    start: 0.53,
    peak: 0.6,
    fade: 0.67,
    end: 0.73,
    corner: "top-left",
    eyebrow: "III.",
    body: "SPACE SHAPES PERCEPTION.<br/>BEHAVIOR. <b>IDENTITY</b>.",
  },
  {
    id: "m4",
    start: 0.73,
    peak: 0.79,
    fade: 0.86,
    end: 0.92,
    corner: "bottom-right",
    eyebrow: "IV.",
    body: "A <b>LIVING FIELD</b><br/>OF EXPERIENCE.",
  },
  {
    id: "m5",
    start: 0.92,
    peak: 0.96,
    fade: 1.05,
    end: 1.1,
    corner: "center",
    eyebrow: "—",
    body: "INFRASTRUCTURE FOR AN<br/><b>EVOLVING HUMANITY</b>.",
  },
];

export function momentVisibility(m: Moment, p: number): { opacity: number; y: number } {
  if (p <= m.start || p >= m.end) return { opacity: 0, y: 0 };

  if (p < m.peak) {
    const t = (p - m.start) / (m.peak - m.start);
    const eased = 1 - Math.pow(1 - t, 3);
    return { opacity: eased, y: 32 * (1 - eased) };
  }
  if (p < m.fade) {
    return { opacity: 1, y: 0 };
  }
  const t = (p - m.fade) / (m.end - m.fade);
  const eased = Math.pow(t, 2);
  return { opacity: 1 - eased, y: -48 * eased };
}

export function cornerClasses(corner: Corner): {
  position: string;
  align: string;
} {
  switch (corner) {
    case "top-left":
      return {
        position: "items-start justify-start pt-[14vh] pl-[6vw] md:pt-[16vh] md:pl-[8vw]",
        align: "items-start text-left",
      };
    case "top-right":
      return {
        position: "items-end justify-start pt-[14vh] pr-[6vw] md:pt-[16vh] md:pr-[8vw]",
        align: "items-end text-right",
      };
    case "bottom-left":
      return {
        position: "items-start justify-end pb-[14vh] pl-[6vw] md:pb-[16vh] md:pl-[8vw]",
        align: "items-start text-left",
      };
    case "bottom-right":
      return {
        position: "items-end justify-end pb-[14vh] pr-[6vw] md:pb-[16vh] md:pr-[8vw]",
        align: "items-end text-right",
      };
    default:
      return {
        position: "items-center justify-center px-6",
        align: "items-center text-center",
      };
  }
}
