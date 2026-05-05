import { getServiceClient } from '../db';

/**
 * Uploads a file to Supabase Storage.
 */
export async function uploadImage(file: File, bucket: string, path: string) {
  const sb = getServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data, error } = await sb.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: true
  });

  if (error) throw error;

  const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path);

  return {
    path: data.path,
    url: publicUrl
  };
}

/**
 * Downloads a file from Storage as a Buffer for AI processing.
 */
export async function downloadImageAsBuffer(path: string, bucket: string) {
  const sb = getServiceClient();
  
  const { data, error } = await sb.storage.from(bucket).download(path);
  
  if (error) throw error;
  
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: data.type
  };
}
