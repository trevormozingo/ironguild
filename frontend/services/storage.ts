/**
 * Storage upload helpers — uploads go through the backend API.
 *
 * The backend (profile-service) handles Firebase Storage via the
 * Admin SDK, so the frontend never touches Storage directly.
 *
 * Path conventions (server-side):
 *   users/{uid}/profile.{ext}                    — profile photo
 *   users/{uid}/posts/{postId}/{index}.{ext}     — post media
 *
 * NOTE: React Native's FormData requires a { uri, type, name } object
 * rather than a Blob. Using a Blob results in an empty file on the server.
 */

import { getIdToken } from './auth';
import { config } from '@/config';

/**
 * Upload (or replace) the user's profile photo via the backend.
 *
 * @param uri – Local file URI from the image picker
 * @returns   – The public download URL
 */
export async function uploadProfilePhoto(uri: string): Promise<string> {
  const token = getIdToken();
  if (!token) throw new Error('Not authenticated');

  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';

  const form = new FormData();
  form.append('file', {
    uri,
    type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
    name: `profile.${ext}`,
  } as any);

  const res = await fetch(`${config.apiBaseUrl}/profile/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Photo upload failed (${res.status})`);
  }

  const { url } = await res.json();
  return url;
}

/**
 * Upload post media files via the backend.
 *
 * @param items – Array of { localUri, mimeType }
 * @returns { postId, media: [{ url, mimeType }, ...] }
 */
export async function uploadPostMedia(
  items: { localUri: string; mimeType: string }[],
): Promise<{ postId: string; media: { url: string; mimeType: string }[] }> {
  const token = getIdToken();
  if (!token) throw new Error('Not authenticated');

  const form = new FormData();

  for (const item of items) {
    const ext = item.localUri.split('.').pop()?.toLowerCase() ?? 'jpg';

    form.append('files', {
      uri: item.localUri,
      type: item.mimeType,
      name: `media.${ext}`,
    } as any);
  }

  const res = await fetch(`${config.apiBaseUrl}/posts/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Media upload failed (${res.status})`);
  }

  return res.json();
}
