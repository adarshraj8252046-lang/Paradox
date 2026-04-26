/**
 * uploadHelpers.ts
 * ----------------------------------------------------------------------------
 * Supabase Storage upload pipeline for the `application-docs` bucket.
 *
 * Each file is stored at:
 *   application-docs/${user.id}/${application_id}/${filename}
 *
 * Client-side validation gate (runs BEFORE any network call):
 *   • Max file size: 3 MB per file
 *   • Max files per application: 10
 *   • Allowed MIME types: image/jpeg, image/png, application/pdf
 *
 * On success, returns an array of public URLs for the uploaded files.
 * On failure, throws with a descriptive error message.
 */

import { supabase } from "../supabase/client";

const BUCKET = "application-docs";
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_FILES = 10;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export interface UploadResult {
  filename: string;
  path: string;
  publicUrl: string;
}

/**
 * Validates files client-side before upload.
 * Throws a descriptive Error if validation fails.
 */
export function validateFiles(files: File[]): void {
  if (files.length === 0) throw new Error("No files selected.");
  if (files.length > MAX_FILES)
    throw new Error(`Too many files. Maximum allowed is ${MAX_FILES}.`);

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type))
      throw new Error(
        `File "${file.name}" has an unsupported type (${file.type}). Allowed: JPEG, PNG, PDF.`
      );
    if (file.size > MAX_FILE_SIZE_BYTES)
      throw new Error(
        `File "${file.name}" exceeds the 3 MB size limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`
      );
  }
}

/**
 * Uploads validated files to the application-docs bucket.
 * Scopes each file to: {userId}/{applicationId}/{filename}
 *
 * @param userId        Authenticated user's UUID
 * @param applicationId Application row UUID
 * @param files         Array of File objects (already validated)
 * @returns             Array of UploadResult with path and publicUrl
 */
export async function uploadApplicationDocs(
  userId: string,
  applicationId: string,
  files: File[]
): Promise<UploadResult[]> {
  validateFiles(files);

  const results: UploadResult[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${applicationId}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw new Error(`Upload failed for "${file.name}": ${error.message}`);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    results.push({
      filename: file.name,
      path,
      publicUrl: urlData.publicUrl,
    });
  }

  return results;
}

/**
 * Writes document metadata rows into `application_documents` table
 * after a successful upload batch.
 */
export async function saveDocumentMetadata(
  applicationId: string,
  uploads: UploadResult[]
): Promise<void> {
  const rows = uploads.map((u) => ({
    application_id: applicationId,
    document_name: u.filename,
    document_url: u.publicUrl,
    storage_path: u.path,
  }));

  const { error } = await supabase.from("application_documents").insert(rows);
  if (error) throw new Error(`Failed to save document metadata: ${error.message}`);
}

/**
 * Convenience: upload files AND save metadata in one call.
 */
export async function uploadAndSaveDocs(
  userId: string,
  applicationId: string,
  files: File[]
): Promise<UploadResult[]> {
  const uploads = await uploadApplicationDocs(userId, applicationId, files);
  await saveDocumentMetadata(applicationId, uploads);
  return uploads;
}
