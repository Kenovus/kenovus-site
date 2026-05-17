import { supabase } from '@/lib/supabase';

export const PROGRESS_PHOTOS_BUCKET = 'progress-photos';

/** Stored in DB: object path inside bucket `{patientId}/{fileName}` — never `file://`. */
export function isRemoteStoragePath(value: string): boolean {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return false;
  if (value.startsWith('file://') || value.startsWith('content://') || value.startsWith('ph://')) return false;
  return value.includes('/');
}

export async function uploadProgressPhotoObject(params: {
  patientId: string;
  angle: string;
  localUri: string;
  mimeType?: string | null;
}): Promise<{ path: string; error: Error | null }> {
  const ext =
    params.mimeType === 'image/png'
      ? 'png'
      : params.mimeType === 'image/webp'
        ? 'webp'
        : params.mimeType === 'image/heic' || params.mimeType === 'image/heif'
          ? 'heic'
          : 'jpg';
  const fileName = `${Date.now()}_${params.angle.replace(/[^a-z0-9_-]/gi, '_')}.${ext}`;
  const path = `${params.patientId}/${fileName}`;

  const res = await fetch(params.localUri);
  if (!res.ok) {
    return { path, error: new Error(`Could not read image (${res.status})`) };
  }
  const buf = await res.arrayBuffer();
  const contentType = params.mimeType ?? 'image/jpeg';

  const { error } = await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).upload(path, buf, {
    contentType,
    upsert: false,
  });

  if (error) return { path, error: new Error(error.message) };
  return { path, error: null };
}

export async function createProgressPhotoSignedUrl(
  storagePath: string,
  expiresSec = 3600,
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, expiresSec);
  if (error) return { url: null, error: new Error(error.message) };
  return { url: data?.signedUrl ?? null, error: null };
}

export async function resolveProgressPhotoImageUrl(stored: string): Promise<string> {
  if (!stored) return '';
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;
  if (!isRemoteStoragePath(stored)) return stored;
  const { url } = await createProgressPhotoSignedUrl(stored);
  return url ?? stored;
}
