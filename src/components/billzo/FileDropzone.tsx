import { useRef, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  onFiles,
  accept = "image/*,application/pdf",
  multiple = false,
  busy = false,
  label = "Drag & drop file here",
  hint = "or click to browse · PNG, JPG, PDF up to 10MB",
  className,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-4 py-8 text-center transition-all duration-300 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        over && "scale-[1.01] border-primary bg-primary/10",
        busy && "pointer-events-none opacity-60",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-6 animate-spin text-primary" />
      ) : (
        <CloudUpload className="size-6 text-primary" />
      )}
      <p className="text-sm font-medium">{busy ? "Uploading…" : label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}