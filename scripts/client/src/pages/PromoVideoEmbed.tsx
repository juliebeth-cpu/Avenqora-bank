import { useRef, useState } from "react";
import { VolumeX, Volume2 } from "lucide-react";

export interface PromoVideo {
  fileName: string;
  contentType: string;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  placement: "hero" | "about" | "featured";
  viewURL: string | null;
}

export function PromoVideoEmbed({ video, primary, className = "" }: { video: PromoVideo; primary: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  if (!video.viewURL) return null;

  const toggleMute = () => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = !element.muted;
    setMuted(element.muted);
  };

  return (
    <div className={"relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl " + className}>
      <video
        ref={videoRef}
        key={video.viewURL}
        src={video.viewURL}
        autoPlay={video.autoplay}
        loop={video.loop}
        muted={muted}
        playsInline
        controls={!video.autoplay}
        preload={video.autoplay ? "auto" : "metadata"}
        className="w-full h-full object-cover"
        style={{ maxHeight: "480px" }}
      />
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40"
        style={{ background: "rgba(0,0,0,0.60)" }}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px " + primary + "30" }} />
    </div>
  );
}
