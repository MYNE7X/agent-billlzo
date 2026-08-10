import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "agent-documents";

const slug = (name: string) => name.replace(/[^\w.\-]+/g, "_");

export async function uploadAgentFile(agentId: string, category: string, file: File) {
  const path = `${agentId}/${category}/${Date.now()}-${slug(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(path?: string | null, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function removeAgentFile(path?: string | null) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Upload a file and register it in agent_documents. Returns the storage path. */
export async function uploadAndRegister(opts: {
  agentId: string;
  category: string;
  file: File;
  uploadedBy?: string | null;
}) {
  const path = await uploadAgentFile(opts.agentId, opts.category, opts.file);
  const { error } = await supabase.from("agent_documents").insert({
    agent_id: opts.agentId,
    category: opts.category,
    file_url: path,
    file_path: path,
    file_name: opts.file.name,
    file_type: opts.file.type || "application/octet-stream",
    file_size: opts.file.size,
    uploaded_by: opts.uploadedBy ?? null,
  });
  if (error) throw error;
  return path;
}