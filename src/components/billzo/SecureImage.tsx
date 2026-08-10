import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

export function SecureImage({
  path,
  alt,
  className,
  onLoaded,
}: {
  path?: string | null;
  alt: string;
  className?: string;
  onLoaded?: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    void signedUrl(path).then((u) => {
      if (!active) return;
      setUrl(u);
      if (u) onLoaded?.(u);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!path || !url) {
    return (
      <div className={cn("grid place-items-center bg-secondary/50 text-muted-foreground", className)}>
        <ImageOff className="size-5" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}