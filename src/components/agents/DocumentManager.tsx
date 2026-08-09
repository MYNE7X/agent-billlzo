import { useState } from "react";
import { Eye, Trash2, FileText, Replace } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDropzone } from "@/components/billzo/FileDropzone";
import { ImagePreviewModal } from "@/components/billzo/ImagePreviewModal";
import { SecureImage } from "@/components/billzo/SecureImage";
import { DOCUMENT_CATEGORIES, formatDate, labelize } from "@/lib/billzo";
import { removeAgentFile, signedUrl, uploadAndRegister } from "@/lib/storage";
import { useAgentDocuments, type AgentDocument } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function DocumentManager({ agentId }: { agentId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: docs, isLoading } = useAgentDocuments(agentId);
  const [category, setCategory] = useState<string>("other");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; doc: AgentDocument } | null>(null);
  const [replacing, setReplacing] = useState<AgentDocument | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["agent-documents", agentId] });

  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      for (const file of files) {
        await uploadAndRegister({ agentId, category, file, uploadedBy: user?.id ?? null });
      }
      toast.success(`${files.length} file(s) uploaded`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const replace = async (doc: AgentDocument, file: File) => {
    setBusy(true);
    try {
      await removeAgentFile(doc.file_path);
      const path = await uploadAndRegister({
        agentId,
        category: doc.category,
        file,
        uploadedBy: user?.id ?? null,
      });
      await supabase.from("agent_documents").delete().eq("id", doc.id);
      toast.success("File replaced");
      setReplacing(null);
      refresh();
      void path;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Replace failed");
    } finally {
      setBusy(false);
    }
  };

  const destroy = async (doc: AgentDocument) => {
    await removeAgentFile(doc.file_path);
    const { error } = await supabase.from("agent_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("File deleted");
    refresh();
  };

  const openPreview = async (doc: AgentDocument) => {
    setPreview({ url: null, doc });
    const url = await signedUrl(doc.file_path ?? doc.file_url);
    setPreview({ url, doc });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FileDropzone className="flex-1" multiple busy={busy} onFiles={(f) => void upload(f)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : !docs?.length ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No documents uploaded yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              className="glass glass-hover animate-rise flex gap-3 rounded-xl p-3 hover:glass-hover-on"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {(doc.file_type ?? "").startsWith("image/") ? (
                <SecureImage
                  path={doc.file_path ?? doc.file_url}
                  alt={doc.file_name}
                  className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-secondary/60">
                  <FileText className="size-6 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">{labelize(doc.category)}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(doc.uploaded_date)}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void openPreview(doc)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplacing(doc)}>
                    <Replace className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void destroy(doc)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {replacing ? (
        <div className="glass rounded-xl p-4">
          <p className="mb-2 text-sm font-medium">Replace “{replacing.file_name}”</p>
          <FileDropzone busy={busy} onFiles={(f) => void replace(replacing, f[0]!)} />
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReplacing(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      <ImagePreviewModal
        open={Boolean(preview)}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
        url={preview?.url ?? null}
        name={preview?.doc.file_name ?? null}
        type={preview?.doc.file_type ?? null}
      />
    </div>
  );
}