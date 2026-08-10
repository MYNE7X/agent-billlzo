import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

export function ImagePreviewModal({
  open,
  onOpenChange,
  url,
  name,
  type,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  name?: string | null;
  type?: string | null;
}) {
  const isImage = (type ?? "").startsWith("image/");
  const isPdf = (type ?? "").includes("pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-3xl border-glass-border">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{name ?? "Preview"}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 grid max-h-[65vh] place-items-center overflow-auto rounded-xl bg-background/40 p-3">
          {!url ? (
            <p className="py-16 text-sm text-muted-foreground">Preparing secure preview…</p>
          ) : isImage ? (
            <img src={url} alt={name ?? "Document preview"} className="max-h-[60vh] rounded-lg object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={name ?? "Document"} className="h-[60vh] w-full rounded-lg" />
          ) : (
            <p className="py-16 text-sm text-muted-foreground">Preview not available for this file type.</p>
          )}
        </div>
        {url ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open
              </a>
            </Button>
            <Button asChild>
              <a href={url} download={name ?? undefined}>
                <Download className="size-4" /> Download
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}