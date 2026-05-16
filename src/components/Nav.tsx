import { useEffect, useState } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        scrolled
          ? "bg-ink/70 backdrop-blur-md border-b border-gold/15"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 md:h-[72px] md:px-10">
        {/* Brand wordmark only */}
        <a href="#" className="group flex items-center">
          <span className="wordmark text-[12px] text-cream/90 transition-opacity duration-500 group-hover:text-cream md:text-[13px]">
            Cocoon
          </span>
        </a>

        {/* Right side — small label */}
        <span className="hidden md:block wordmark text-[10px] text-cream/55">
          Ascension Center
        </span>
      </div>
    </header>
  );
}
