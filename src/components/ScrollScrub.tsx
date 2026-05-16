import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MOMENTS,
  cornerClasses,
  frameFromProgress,
  momentState,
  introOpacity,
} from "./Moments";

type Props = { totalFrames: number };

const framePath = (i: number) =>
  `/frames/frame_${String(i).padStart(3, "0")}.webp`;

export default function ScrollScrub({ totalFrames }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const momentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentRef = useRef({ progress: 0 });
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  // Preload all frames
  useEffect(() => {
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let done = 0;

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      img.src = framePath(i);
      img.onload = () => {
        done += 1;
        if (cancelled) return;
        setLoaded(done);
        if (done === totalFrames) setReady(true);
      };
      img.onerror = () => {
        done += 1;
        if (!cancelled) setLoaded(done);
      };
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
    let dw = cw,
      dh = ch,
      dx = 0,
      dy = 0;
    if (ir > cr) {
      dh = ch;
      dw = ch * ir;
      dx = (cw - dw) / 2;
    } else {
      dw = cw;
      dh = cw / ir;
      dy = (ch - dh) / 2;
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
  };

  // Single-frame draw — no crossfade (avoids motion-blur double-exposure).
  // Smoothness comes from Lenis + GSAP scrub damping.
  const drawAt = (frameFloat: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const idx = Math.max(
      0,
      Math.min(imagesRef.current.length - 1, Math.round(frameFloat))
    );
    ctx.clearRect(0, 0, cw, ch);
    drawFrame(ctx, imagesRef.current[idx], cw, ch, 1);
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

    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "+=900%",
      scrub: 1.1,
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
        updateMoments(p);
      },
    });

    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
    };
  }, [ready, totalFrames]);

  const pct = Math.round((loaded / totalFrames) * 100);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-ink"
      aria-label="Entering Cocoon"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Soft top + bottom gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/55" />

      {/* Intro brand overlay — typographic, fades over the first video segment */}
      <div
        ref={introRef}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        <h1 className="intro-mark wordmark text-[clamp(2.5rem,8vw,6rem)] text-cream drop-shadow-[0_2px_28px_rgba(0,0,0,0.6)]">
          Cocoon
        </h1>
        <span className="intro-mark wordmark mt-4 text-[clamp(0.7rem,1vw,0.85rem)] text-gold/85">
          Ascension Center
        </span>
        <div className="intro-rule mt-7 h-px w-20 bg-gold/55" />
        <p className="intro-sub thin mt-7 max-w-2xl text-[clamp(1.05rem,2vw,1.6rem)] leading-snug text-cream/95 drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]">
          A sanctuary for <span className="bold-accent">human potential</span>.
        </p>
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
                <img
                  src="/logo-mark.webp"
                  alt=""
                  aria-hidden
                  className="h-9 w-auto opacity-90 drop-shadow-[0_2px_18px_rgba(0,0,0,0.7)] md:h-11"
                  decoding="async"
                />
                {m.eyebrow && (
                  <span className="wordmark text-[10px] text-gold/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                    {m.eyebrow}
                  </span>
                )}
                <p
                  className="thin text-[clamp(1.7rem,4.2vw,3.5rem)] leading-[1.06] tracking-[0.015em] text-cream"
                  style={{
                    textShadow: "0 2px 22px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.6)",
                  }}
                  dangerouslySetInnerHTML={{ __html: m.body }}
                />
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

      {/* Loader */}
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink">
          <div className="text-center">
            <div className="label text-cream/60">entering</div>
            <div className="mt-4 h-px w-40 bg-cream/15">
              <div
                className="h-full bg-gold transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="label mt-3 tabular-nums text-cream/40">{pct}%</div>
          </div>
        </div>
      )}
    </section>
  );
}
