import { useState, type CSSProperties, type SyntheticEvent } from "react";

interface WebsiteLogoProps {
  src: string;
  alt: string;
  size: number;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
}

export default function WebsiteLogo({ src, alt, size, className = "", style, "data-testid": testId }: WebsiteLogoProps) {
  const [aspectRatio, setAspectRatio] = useState(1);
  const isWideWordmark = aspectRatio > 1.55;
  const width = isWideWordmark ? Math.min(size * 2.5, size * aspectRatio) : size;

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      setAspectRatio(image.naturalWidth / image.naturalHeight);
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      data-testid={testId}
      onLoad={handleLoad}
      className={`shrink-0 object-contain ${className}`}
      style={{
        width,
        height: size,
        borderRadius: isWideWordmark ? Math.max(6, Math.round(size * 0.18)) : "50%",
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
