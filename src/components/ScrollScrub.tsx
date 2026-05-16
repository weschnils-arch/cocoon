import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MOMENTS, momentVisibility, cornerClasses } from "./Moments";

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
  const currentRef = useRef({ frame: 0 });
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

  // Crossfade between adjacent frames based on fractional position
  // -> smooths out the 24fps source so it feels continuous
  const draw = (frameFloat: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    const i0 = Math.floor(frameFloat);
    const i1 = Math.min(i0 + 1, imagesRef.current.length - 1);
    const t = frameFloat - i0;

    const a = imagesRef.current[i0];
    const b = imagesRef.current[i1];

    ctx.clearRect(0, 0, cw, ch);
    drawFrame(ctx, a, cw, ch, 1);
    if (i1 !== i0 && b && t > 0) {
      drawFrame(ctx, b, cw, ch, t);
    }
  };

  // Intro reveal
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
    draw(0);

    const onResize = () => {
      sizeCanvas();
      draw(currentRef.current.frame);
    };
    window.addEventListener("resize", onResize);

    const updateMoments = (progress: number) => {
      MOMENTS.forEach((m) => {
        const el = momentRefs.current[m.id];
        if (!el) return;
        const { opacity, y } = momentVisibility(m, progress);
        el.style.opacity = String(opacity);
        el.style.transform = `translate3d(0, ${y}px, 0)`;
        el.style.visibility = opacity < 0.01 ? "hidden" : "visible";
      });
    };

    const tween = gsap.to(currentRef.current, {
      frame: totalFrames - 1,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "+=650%",
        scrub: 1.1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const f = Math.min(
            totalFrames - 1,
            Math.max(0, self.progress * (totalFrames - 1))
          );
          currentRef.current.frame = f;
          draw(f);

          // Intro overlay fades out by 11% progress
          if (introRef.current) {
            const o = Math.max(0, 1 - self.progress / 0.11);
            introRef.current.style.opacity = String(o);
            introRef.current.style.pointerEvents = o < 0.05 ? "none" : "auto";
          }
          if (cueRef.current) {
            const o = Math.max(0, 1 - self.progress / 0.05);
            cueRef.current.style.opacity = String(o);
          }

          updateMoments(self.progress);
        },
      },
    });

    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("resize", onResize);
      tween.scrollTrigger?.kill();
      tween.kill();
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

      {/* Soft top + bottom gradient to anchor overlay copy */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/15 to-ink/65" />

      {/* Intro brand overlay — visible at scroll 0, fades as journey begins */}
      <div
        ref={introRef}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        <img
          src="/logo.webp"
          alt="Cocoon — Ascension Center"
          className="intro-mark h-auto w-[min(520px,72vw)] drop-shadow-[0_2px_28px_rgba(0,0,0,0.55)]"
          fetchPriority="high"
          decoding="async"
        />
        <div className="intro-rule mt-6 h-px w-20 bg-gold/55" />
        <p className="intro-sub thin mt-7 max-w-2xl text-[clamp(1.05rem,2vw,1.6rem)] leading-snug text-cream/95 drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]">
          A sanctuary for <span className="bold-accent">human potential</span>.
        </p>
      </div>

      {/* Scroll-keyed text moments — each bundle floats to a different corner */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {MOMENTS.map((m) => {
          const c = cornerClasses(m.corner);
          return (
            <div
              key={m.id}
              ref={(el) => {
                momentRefs.current[m.id] = el;
              }}
              className={`absolute inset-0 flex flex-col ${c.position} will-change-[opacity,transform]`}
              style={{ opacity: 0, visibility: "hidden" }}
            >
              <div
                className={`flex flex-col ${c.align} gap-4 rounded-2xl bg-ink/55 backdrop-blur-md border border-cream/8 px-6 py-7 md:px-9 md:py-9 max-w-[min(680px,90vw)] shadow-[0_18px_60px_rgba(0,0,0,0.5)]`}
              >
                <img
                  src="/logo-mark.webp"
                  alt=""
                  aria-hidden
                  className="h-9 w-auto opacity-90 md:h-11"
                  decoding="async"
                />
                {m.eyebrow && (
                  <span className="wordmark text-[10px] text-gold/80">
                    {m.eyebrow}
                  </span>
                )}
                <p
                  className="thin text-[clamp(1.6rem,4vw,3.25rem)] leading-[1.08] tracking-[0.02em] text-cream"
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
