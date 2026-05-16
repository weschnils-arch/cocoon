import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MOMENTS,
  cornerClasses,
  frameFromProgress,
  momentState,
  introOpacity,
  footerOpacityFromProgress,
} from "./Moments";

type Props = { totalFrames: number };

const framePath = (i: number) =>
  `/frames/frame_${String(i).padStart(3, "0")}.avif`;

export default function ScrollScrub({ totalFrames }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const footerCardRef = useRef<HTMLDivElement>(null);
  const momentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentRef = useRef({ progress: 0 });
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  // Progressive preload — uses img.decode() so frames are GPU-ready before counted as loaded.
  // Prevents flicker during scroll because draw() never has to wait on a decode.
  useEffect(() => {
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let done = 0;
    const readyThreshold = Math.max(60, Math.ceil(totalFrames * 0.22));

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      img.src = framePath(i);
      // decode() guarantees the image is fully decoded to memory before resolving.
      // Critical for AVIF + canvas scrubbing — onload alone fires earlier and the first
      // drawImage call would otherwise trigger a synchronous decode = flicker.
      img
        .decode()
        .catch(() => {})
        .finally(() => {
          done += 1;
          if (cancelled) return;
          setLoaded(done);
          if (done >= readyThreshold) setReady(true);
        });
      imgs.push(img);
    }
    imagesRef.current = imgs;

    return () => {
      cancelled = true;
    };
  }, [totalFrames]);

  const sizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // Composition offset — shifts the canvas image to align the building visually.
  // Positive X = shift right; negative = shift left.
  const COMP_OFFSET_X = -0.02;
  // Extra zoom on top of cover so shifting doesn't reveal a border edge.
  const COMP_ZOOM = 1.08;

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cw: number,
    ch: number,
    alpha = 1
  ) => {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = cw / ch;
    let dw: number, dh: number;
    if (ir > cr) {
      dh = ch;
      dw = ch * ir;
    } else {
      dw = cw;
      dh = cw / ir;
    }
    // Apply zoom
    dw *= COMP_ZOOM;
    dh *= COMP_ZOOM;
    // Center then horizontal offset
    const dx = (cw - dw) / 2 + cw * COMP_OFFSET_X;
    const dy = (ch - dh) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
  };

  // Find the nearest LOADED frame to a target index — falls back during progressive load.
  const nearestReady = (target: number): HTMLImageElement | null => {
    const imgs = imagesRef.current;
    const n = imgs.length;
    if (n === 0) return null;
    const t = Math.max(0, Math.min(n - 1, target));
    if (imgs[t]?.complete && imgs[t].naturalWidth > 0) return imgs[t];
    // Spiral out from target — first hit wins
    for (let d = 1; d < n; d++) {
      const lo = t - d;
      const hi = t + d;
      if (lo >= 0 && imgs[lo]?.complete && imgs[lo].naturalWidth > 0) return imgs[lo];
      if (hi < n && imgs[hi]?.complete && imgs[hi].naturalWidth > 0) return imgs[hi];
    }
    return null;
  };

  // Single-frame draw — never goes blank: if target frame isn't loaded yet,
  // falls back to the nearest loaded frame.
  const drawAt = (frameFloat: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const target = Math.round(frameFloat);
    const img = nearestReady(target);
    if (!img) return;
    ctx.clearRect(0, 0, cw, ch);
    drawFrame(ctx, img, cw, ch, 1);
  };

  // Intro reveal animations
  useEffect(() => {
    if (!ready) return;
    gsap.fromTo(
      ".intro-mark",
      { opacity: 0, y: 24, filter: "blur(10px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.6, ease: "power3.out", delay: 0.25 }
    );
    gsap.fromTo(
      ".intro-rule",
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.85, transformOrigin: "center" }
    );
    gsap.fromTo(
      ".intro-sub",
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 1.05 }
    );
    gsap.fromTo(
      ".intro-cue",
      { opacity: 0 },
      { opacity: 1, duration: 1.4, ease: "power2.out", delay: 1.6 }
    );
    gsap.to(".intro-cue-line", {
      scaleY: 0.35,
      transformOrigin: "top",
      duration: 1.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  }, [ready]);

  // ScrollTrigger wiring
  useEffect(() => {
    if (!ready || !sectionRef.current) return;
    sizeCanvas();
    drawAt(frameFromProgress(0));

    const onResize = () => {
      sizeCanvas();
      drawAt(frameFromProgress(currentRef.current.progress));
    };
    window.addEventListener("resize", onResize);

    const updateMoments = (p: number) => {
      const vh = window.innerHeight;
      MOMENTS.forEach((m) => {
        const el = momentRefs.current[m.id];
        if (!el) return;
        const { opacity, yFrac } = momentState(m.id, p);
        el.style.opacity = String(opacity);
        el.style.transform = `translate3d(0, ${yFrac * vh}px, 0)`;
        el.style.visibility = opacity < 0.01 ? "hidden" : "visible";
      });
    };

    // Mobile gets longer pin length + heavier scrub damping so text doesn't rush through.
    // (Phones have shorter viewports so the same % gives fewer scroll-pixels per moment.)
    const isMobile = window.innerWidth < 768;
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: () => `+=${window.innerWidth < 768 ? 1500 : 900}%`,
      scrub: isMobile ? 1.7 : 1.1,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        currentRef.current.progress = p;
        drawAt(frameFromProgress(p));

        if (introRef.current) {
          const o = introOpacity(p);
          introRef.current.style.opacity = String(o);
          introRef.current.style.pointerEvents = o < 0.05 ? "none" : "auto";
        }
        if (cueRef.current) {
          const o = Math.max(0, 1 - p / 0.04);
          cueRef.current.style.opacity = String(o);
        }
        if (footerRef.current) {
          const o = footerOpacityFromProgress(p);
          footerRef.current.style.opacity = String(o);
          footerRef.current.style.pointerEvents = o > 0.6 ? "auto" : "none";
          // Ramp the closing card's blur with reveal progress so it doesn't snap on.
          if (footerCardRef.current) {
            const blurPx = (o * 12).toFixed(1);
            const filter = `blur(${blurPx}px) saturate(140%)`;
            footerCardRef.current.style.backdropFilter = filter;
            (footerCardRef.current.style as CSSStyleDeclaration & {
              webkitBackdropFilter?: string;
            }).webkitBackdropFilter = filter;
          }
        }
        updateMoments(p);
      },
    });

    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
    };
  }, [ready, totalFrames]);

  const readyThreshold = Math.max(60, Math.ceil(totalFrames * 0.22));
  const pct = Math.min(100, Math.round((loaded / readyThreshold) * 100));

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-ink"
      aria-label="Entering Cocoon"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Soft top + bottom gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/55" />

      {/* Intro brand overlay — top cluster (Ascension Center + tagline) at top,
          Cocoon wordmark dropped near the bottom. Fades over first video segment. */}
      <div
        ref={introRef}
        className="absolute inset-0 z-10 flex flex-col items-center justify-between px-6 pt-[7vh] pb-[14vh] text-center md:pt-[8vh] md:pb-[16vh]"
      >
        {/* TOP: Ascension Center + tagline — nudged slightly left to balance with the building shot */}
        <div className="flex flex-col items-center -translate-x-[3vw] md:-translate-x-[4vw]">
          <span className="intro-mark wordmark text-[clamp(0.7rem,1vw,0.85rem)] text-cream">
            Ascension Center
          </span>
          <div className="intro-rule mt-6 h-px w-20 bg-cream/45" />
          <p className="intro-sub body mt-7 max-w-2xl text-[clamp(1rem,1.6vw,1.35rem)] leading-snug text-cream/95 drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]">
            A sanctuary for <span className="bold-accent">human potential</span>.
          </p>
        </div>

        {/* BOTTOM: Cocoon wordmark */}
        <h1 className="intro-mark wordmark text-[clamp(2.5rem,8vw,6rem)] text-cream drop-shadow-[0_2px_28px_rgba(0,0,0,0.6)]">
          Cocoon
        </h1>
      </div>

      {/* Scroll-keyed text moments — travel bottom → top across the screen during each pause */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {MOMENTS.map((m) => {
          const c = cornerClasses(m.corner);
          return (
            <div
              key={m.id}
              ref={(el) => {
                momentRefs.current[m.id] = el;
              }}
              className={`absolute inset-0 flex flex-col justify-center ${c.align} px-6 md:px-[8vw] will-change-[opacity,transform]`}
              style={{ opacity: 0, visibility: "hidden" }}
            >
              <div className={`flex flex-col ${c.align} gap-4 max-w-[min(720px,92vw)]`}>
                <div className="breathe-line h-[32rem] w-px md:h-[48rem]" aria-hidden />
                <span className="wordmark text-[11px] text-cream md:text-[12px]">
                  Cocoon
                </span>
                {m.eyebrow && (
                  <span className="label text-cream/65">{m.eyebrow}</span>
                )}
                <div
                  className={`inline-flex flex-col ${c.align === "items-end text-right" ? "items-end" : c.align === "items-start text-left" ? "items-start" : "items-center"} gap-6 max-w-[min(640px,90vw)]`}
                  style={{
                    backdropFilter: "blur(36px) saturate(150%)",
                    WebkitBackdropFilter: "blur(36px) saturate(150%)",
                    background: "rgba(20,18,16,0.58)",
                    border: "1px solid rgba(244,237,224,0.14)",
                    borderRadius: "16px",
                    boxShadow:
                      "0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                    padding: "1.5em 1.6em 1.7em",
                    isolation: "isolate",
                    transform: "translateZ(0)",
                    willChange: "backdrop-filter",
                  }}
                >
                  <p
                    className="thin text-[clamp(1.5rem,3.6vw,2.9rem)] leading-[1.06] tracking-[0.015em] text-cream"
                    dangerouslySetInnerHTML={{ __html: m.body }}
                  />
                  {m.sub && (
                    <p
                      className={`body text-[clamp(0.92rem,1.05vw,1.05rem)] leading-[1.65] text-cream/90 ${c.align}`}
                    >
                      {m.sub}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll cue */}
      <div
        ref={cueRef}
        className="intro-cue absolute bottom-10 left-1/2 z-10 -translate-x-1/2 text-center"
      >
        <span className="label block text-cream/75">scroll to enter</span>
        <div className="intro-cue-line mx-auto mt-4 h-10 w-px bg-cream/70" />
      </div>

      {/* AVIF preload reference - frames preloaded via Image() in useEffect */}
      {/* Closing / Footer — fades in over the last frame at the end of scroll */}
      <div
        ref={footerRef}
        className="absolute inset-0 z-20 flex flex-col"
        style={{ opacity: 0 }}
      >
        {/* Subtle dark gradient — only anchors the top/bottom, middle stays clear so the final frame shows through */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/25 via-transparent to-ink/50" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1400px] flex-col justify-between px-6 pt-[16vh] pb-8 md:px-12 md:pt-[14vh] md:pb-10">
          {/* Closing headline — same dark glass treatment as the moment boxes */}
          <div className="flex flex-col items-center text-center">
            <div className="breathe-line h-16 w-px md:h-24" aria-hidden />
            <span className="wordmark mt-5 text-[11px] text-cream md:text-[12px]">
              Cocoon
            </span>
            <div
              ref={footerCardRef}
              className="mt-7 inline-flex flex-col items-center gap-5"
              style={{
                // Initial blur 0 — gets ramped by onUpdate based on footer reveal progress
                backdropFilter: "blur(0px) saturate(140%)",
                WebkitBackdropFilter: "blur(0px) saturate(140%)",
                background: "rgba(20,18,16,0.72)",
                border: "1px solid rgba(244,237,224,0.14)",
                borderRadius: "16px",
                boxShadow:
                  "0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                padding: "1.5em 1.6em 1.7em",
                isolation: "isolate",
                transform: "translateZ(0)",
                willChange: "backdrop-filter",
              }}
            >
              <h2 className="display-thin whitespace-nowrap text-[clamp(1.25rem,3.6vw,3.25rem)] text-cream">
                A space for what you are{" "}
                <span className="bold-accent">becoming</span>.
              </h2>
              <p className="body max-w-[60ch] text-center text-[clamp(0.95rem,1.2vw,1.1rem)] leading-[1.65] text-cream/90">
                Architecture is not neutral.{" "}
                <span className="bold-accent">Cocoon</span> is the
                infrastructure for an evolving humanity — a global system of
                environments designed to align body, mind, and inner state, so
                that human potential can become consistent, expressed, and
                lived.
              </p>
            </div>
          </div>

          {/* Footer chrome — cream text on dark wash, consistent with rest of journey */}
          <div className="mt-10 flex flex-col gap-8 border-t border-cream/12 pt-8 md:gap-4">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
              <div>
                <span className="wordmark text-[10px] text-gold/85">Brand</span>
                <p className="body mt-3 text-[13px] leading-relaxed text-cream/85">
                  Cocoon
                  <br />
                  Ascension Center
                  <br />
                  est. 2026
                </p>
              </div>
              <div>
                <span className="wordmark text-[10px] text-gold/85">Contact</span>
                <p className="body mt-3 text-[13px] text-cream/85">
                  <a
                    href="mailto:hello@cocoon.center"
                    className="border-b border-cream/25 pb-px transition-colors hover:border-gold hover:text-cream"
                  >
                    hello@cocoon.center
                  </a>
                </p>
              </div>
              <div>
                <span className="wordmark text-[10px] text-gold/85">Vision</span>
                <p className="body mt-3 text-[13px] leading-relaxed text-cream/85">
                  Translating the ascension of human consciousness into physical
                  form.
                </p>
              </div>
              <div>
                <span className="wordmark text-[10px] text-gold/85">Status</span>
                <p className="body mt-3 text-[13px] leading-relaxed text-cream/85">
                  In development. Founding cohort opening 2026.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-cream/10 pt-6 text-center md:flex-row md:text-left">
              <span className="label text-cream/55">
                © {new Date().getFullYear()} Cocoon. All rights reserved.
              </span>
              <span className="label text-cream/55">
                Architecture for an evolving humanity.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Loader — branded, vertical line fills upward as frames preload */}
      {!ready && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink px-6 text-center">
          <h1 className="wordmark text-[clamp(2.25rem,7vw,5rem)] text-cream">
            Cocoon
          </h1>
          <span className="wordmark mt-3 text-[clamp(0.65rem,0.9vw,0.78rem)] text-gold/85">
            Ascension Center
          </span>

          {/* Vertical fill line — grows from bottom to top with preload progress */}
          <div className="relative mt-12 h-48 w-px overflow-hidden bg-cream/12 md:h-64">
            <div
              className="absolute bottom-0 left-0 w-full bg-gold transition-[height] duration-300 ease-out"
              style={{ height: `${pct}%` }}
            />
          </div>

          <div className="label mt-6 tabular-nums text-cream/55">{pct}%</div>
          <div className="label mt-2 text-cream/35">entering</div>
        </div>
      )}
    </section>
  );
}
