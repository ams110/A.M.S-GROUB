"use client";

import { createClient } from "@/lib/supabase/client";

export const MEDIA_BUCKET = "store-media";

/**
 * Upload an image to the public `store-media` bucket and return its public URL.
 * `folder` groups files (e.g. "products", "categories", "site").
 * Throws on failure so callers can surface the error.
 */
export async function uploadImage(file: File, folder = "products"): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
