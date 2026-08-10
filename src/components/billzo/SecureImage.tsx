import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

/**
 * Global in-memory cache for signed URLs.
 * Key = storage path, Value = { url, expires }
 * Signed URLs from Supabase are valid for 1 hour (3600s).
 * We cache them for 50 minutes (3000s) to be safe — after that we re-fetch.
 *
 * This prevents images from reloading/flashing every time the user navigates
 * between pages, since the signed URL is reused from cache.
 */
const urlCache = new Map<string, { url: string; expires: number }>();
const CACHE_TTL = 50 * 60 * 1000; // 50 minutes in milliseconds

/** Pending requests — dedup concurrent fetches for the same path. */
const pendingRequests = new Map<string, Promise<string | null>>();

async function getCachedSignedUrl(path: string): Promise<string | null> {
  // Check cache
  const cached = urlCache.get(path);
  if (cached && Date.now() < cached.expires) {
    return cached.url;
  }

  // Check if a request is already in-flight for this path
  const pending = pendingRequests.get(path);
  if (pending) {
    return pending;
  }

  // Start a new request
  const promise = signedUrl(path).then((url) => {
    if (url) {
      urlCache.set(path, { url, expires: Date.now() + CACHE_TTL });
    }
    pendingRequests.delete(path);
    return url;
  }).catch(() => {
    pendingRequests.delete(path);
    return null;
  });

  pendingRequests.set(path, promise);
  return promise;
}

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
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    // If we already have the URL in cache, use it immediately — no flash
    const cached = path ? urlCache.get(path) : undefined;
    if (cached && Date.now() < cached.expires) {
      setUrl(cached.url);
      setError(false);
      return;
    }

    // Otherwise fetch (but don't clear the existing URL while loading —
    // this prevents the image from disappearing during navigation)
    if (!path) {
      setUrl(null);
      return;
    }

    void getCachedSignedUrl(path).then((u) => {
      if (!active) return;
      if (u) {
        setUrl(u);
        setError(false);
        onLoaded?.(u);
      } else {
        setError(true);
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!path) {
    return (
      <div className={cn("grid place-items-center bg-secondary/50 text-muted-foreground", className)}>
        <ImageOff className="size-5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("grid place-items-center bg-secondary/50 text-muted-foreground", className)}>
        <ImageOff className="size-5" />
      </div>
    );
  }

  if (!url) {
    // Loading state — show a subtle shimmer instead of the ImageOff icon
    return (
      <div className={cn("animate-shimmer bg-secondary/50", className)} />
    );
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
