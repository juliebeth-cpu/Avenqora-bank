import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface MediaItem {
  id: number;
  name: string;
  objectPath: string;
  contentType: string;
  mediaType: string;
  caption: string | null;
}

async function fetchPublicMedia(): Promise<MediaItem[]> {
  const res = await fetch("/api/public/media-library");
  if (!res.ok) return [];
  return res.json();
}

interface Props {
  className?: string;
  overlay?: boolean; // darken overlay for text legibility
}

export default function MediaSlideshow({ className = "", overlay = true }: Props) {
  const { data: items = [] } = useQuery<MediaItem[]>({
    queryKey: ["public-media-library"],
    queryFn: fetchPublicMedia,
    staleTime: 60_000,
    retry: false,
  });

  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = () => {
    if (items.length <= 1) return;
    setAnimating(true);
    setPrev(current);
    setCurrent(c => (c + 1) % items.length);
    setTimeout(() => {
      setPrev(null);
      setAnimating(false);
    }, 700);
  };

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setTimeout(advance, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, items.length]);

  // Auto-play video when it becomes the active slide
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [current]);

  if (items.length === 0) return null;

  const renderSlide = (index: number, zIndex: number, opacity: number, transform: string) => {
    const item = items[index];
    if (!item) return null;

    return (
      <div
        key={`${item.id}-${zIndex}`}
        className="absolute inset-0"
        style={{
          zIndex,
          opacity,
          transform,
          transition: "opacity 700ms ease-in-out, transform 700ms ease-in-out",
        }}
      >
        {item.mediaType === "video" ? (
          <video
            ref={index === current ? videoRef : undefined}
            src={`/api/public/media-library/${item.id}/serve`}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={`/api/public/media-library/${item.id}/serve`}
            alt={item.caption ?? item.name}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        )}
        {item.caption && (
          <div className="absolute bottom-0 left-0 right-0 px-6 py-3 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white text-sm font-medium">{item.caption}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Previous slide (fading out) */}
      {prev !== null && renderSlide(prev, 1, 0, "translateX(-10px)")}

      {/* Current slide (fading in) */}
      {renderSlide(
        current,
        2,
        animating ? 1 : 1,
        animating ? "translateX(0)" : "translateX(0)",
      )}

      {/* Overlay for text legibility */}
      {overlay && (
        <div className="absolute inset-0 z-10 pointer-events-none"
          style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)" }} />
      )}

      {/* Dot navigation */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                setAnimating(true);
                setPrev(current);
                setCurrent(i);
                setTimeout(() => { setPrev(null); setAnimating(false); }, 700);
              }}
              className="rounded-full transition-all"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                background: i === current ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
