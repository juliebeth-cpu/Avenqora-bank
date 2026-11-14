import { useEffect, useRef, useState } from "react";

export const INVESTMENT_ASSET_IMAGES = [
  { src: "/assets/investment/team-collaboration.jpeg", alt: "Investment team collaborating" },
  { src: "/assets/investment/financial-planning.jpeg", alt: "Financial planning workspace" },
  { src: "/assets/investment/investment-office-01.jpeg", alt: "Modern investment office" },
  { src: "/assets/investment/investment-office-02.jpeg", alt: "Contemporary financial office building" },
  { src: "/assets/investment/investment-office-03.jpeg", alt: "Investment office interior" },
  { src: "/assets/investment/investment-office-04.jpeg", alt: "Financial services workplace" },
  { src: "/assets/investment/investment-office-05.jpeg", alt: "Investment business environment" },
  { src: "/assets/investment/investment-office-06.jpeg", alt: "Professional investment team workspace" },
  { src: "/assets/investment/investment-office-07.jpeg", alt: "Modern financial district office" },
  { src: "/assets/investment/investment-office-08.jpeg", alt: "Investment company building" },
  { src: "/assets/investment/investment-office-09.jpeg", alt: "Financial services office" },
  { src: "/assets/investment/investment-office-10.jpeg", alt: "Investment office architecture" },
  { src: "/assets/investment/business-team.jpg", alt: "Business team meeting" },
  { src: "/assets/investment/return-to-work.webp", alt: "Professionals returning to work" },
] as const;

interface Props {
  className?: string;
  intervalMs?: number;
  overlay?: string;
  objectPosition?: string;
  label?: string;
  priority?: boolean;
}

export default function AssetSlideshow({
  className = "",
  intervalMs = 5000,
  overlay = "linear-gradient(135deg, rgba(2,8,23,0.62), rgba(2,8,23,0.2))",
  objectPosition = "center",
  label = "Permanent imagery",
  priority = false,
}: Props) {
  const images = INVESTMENT_ASSET_IMAGES;

  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: "300px 0px", threshold: 0 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((active) => {
        const next = (active + 1) % images.length;
        setPrevious(active);
        if (previousTimer.current) clearTimeout(previousTimer.current);
        previousTimer.current = setTimeout(() => setPrevious(null), 800);
        return next;
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [intervalMs, images.length, nearViewport]);

  useEffect(() => () => {
    if (previousTimer.current) clearTimeout(previousTimer.current);
  }, []);

  const goTo = (next: number) => {
    if (next === current) return;
    setPrevious(current);
    setCurrent(next);
    if (previousTimer.current) clearTimeout(previousTimer.current);
    previousTimer.current = setTimeout(() => setPrevious(null), 800);
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} aria-label={label}>
      {previous !== null && (
        <img
          src={images[previous].src}
          alt=""
          aria-hidden="true"
          className="asset-slideshow-out absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
          decoding="async"
        />
      )}
      <img
        key={current}
        src={images[current].src}
        alt={images[current].alt}
        className="asset-slideshow-in absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition }}
        loading="eager"
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
      {overlay && <div className="absolute inset-0 pointer-events-none" style={{ background: overlay }} />}
      <style>{`
        @keyframes asset-slideshow-in {
          from { opacity: 0; transform: scale(1.02); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes asset-slideshow-out {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.01); }
        }
        .asset-slideshow-in {
          animation: asset-slideshow-in 800ms ease-in-out both;
        }
        .asset-slideshow-out {
          animation: asset-slideshow-out 800ms ease-in-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .asset-slideshow-in,
          .asset-slideshow-out {
            animation-duration: 1ms;
          }
        }
      `}</style>
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            onClick={() => goTo(index)}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: index === current ? 22 : 6,
              backgroundColor: index === current ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)",
            }}
            aria-label={`Show image ${index + 1}`}
            aria-pressed={index === current}
          />
        ))}
      </div>
    </div>
  );
}
