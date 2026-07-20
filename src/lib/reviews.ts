import { supabase } from './supabase';
import type { Review, ReviewInput, ReviewPhotoWithUrl, ReviewWithPhotos } from '../types';

const PHOTO_BUCKET = 'community-photos';
const REVIEW_PAGE_SIZE = 30;

export function createReviewId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export async function getVendorReviews(vendorId: string): Promise<ReviewWithPhotos[]> {
  const { data, error } = await supabase.rpc('get_vendor_reviews', {
    p_vendor_id: vendorId,
    p_limit: REVIEW_PAGE_SIZE,
  });

  if (error) throw error;
  return ((data ?? []) as Array<Omit<ReviewWithPhotos, 'photos'> & {
    photos: Array<Omit<ReviewPhotoWithUrl, 'public_url'>> | null;
  }>).map((row) => {
    const { photos: photoRows, ...review } = row;
    return {
      ...review,
      photos: (photoRows ?? []).map((photo) => ({
        ...photo,
        public_url: supabase.storage
          .from(PHOTO_BUCKET)
          .getPublicUrl(photo.storage_path).data.publicUrl,
      })),
    };
  });
}

export async function reportContent(
  targetType: 'review' | 'photo',
  targetId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('report-content', {
    body: { targetType, targetId, reason },
  });
  if (error) throw error;
}

export async function createReview(
  reviewId: string,
  vendorId: string,
  userId: string,
  input: ReviewInput,
): Promise<Review> {
  const { data, error } = await supabase.from('reviews').upsert({
    id: reviewId,
    vendor_id: vendorId,
    user_id: userId,
    ...input,
  }, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return data as Review;
}

export async function updateReview(
  reviewId: string,
  userId: string,
  input: ReviewInput,
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update(input)
    .eq('id', reviewId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteReview(
  reviewId: string,
  _userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('delete_own_review', {
    p_review_id: reviewId,
  });
  if (error) throw error;
  const paths = Array.isArray(data) ? data.filter((path): path is string => typeof path === 'string') : [];

  // Storage cannot participate in the database transaction. Remove objects
  // only after no user-visible database rows can reference them.
  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(paths);
    if (storageError) {
      // The review is already deleted. Treat object cleanup as best-effort so
      // the UI does not report a failed deletion or keep stale review data.
      console.warn('Review deleted, but photo storage cleanup failed.', storageError);
    }
  }
}

export async function uploadReviewPhoto(
  reviewId: string,
  vendorId: string,
  userId: string,
  file: File,
): Promise<string> {
  const processed = await processReviewPhoto(file);
  const storagePath = `${userId}/${vendorId}/${reviewId}/${Date.now()}-${createReviewId()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, processed, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: rowError } = await supabase.from('review_photos').insert({
    review_id: reviewId,
    user_id: userId,
    storage_path: storagePath,
  });

  if (rowError) {
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
    throw rowError;
  }
  return storagePath;
}

export type SaveReviewRequest = {
  reviewId: string | null;
  createId: string;
  vendorId: string;
  userId: string;
  input: ReviewInput;
  files: File[];
  onPhotoProgress?: (completed: number, total: number) => void;
};

export async function saveReviewWithPhotos({
  reviewId,
  createId,
  vendorId,
  userId,
  input,
  files,
  onPhotoProgress,
}: SaveReviewRequest): Promise<{ reviewId: string; failedFiles: File[] }> {
  let savedReviewId = reviewId;
  if (savedReviewId) {
    await updateReview(savedReviewId, userId, input);
  } else {
    savedReviewId = (await createReview(createId, vendorId, userId, input)).id;
  }

  const failedFiles: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    try {
      await uploadReviewPhoto(savedReviewId, vendorId, userId, files[index]);
    } catch {
      failedFiles.push(files[index]);
    }
    onPhotoProgress?.(index + 1, files.length);
  }

  return { reviewId: savedReviewId, failedFiles };
}

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateReviewPhotos(files: File[], existingCount = 0): string | null {
  if (existingCount + files.length > 3) return 'A review can have up to 3 photos total.';
  const invalidType = files.find((file) => !ALLOWED_PHOTO_TYPES.has(file.type));
  if (invalidType) return `${invalidType.name}: unsupported file type.`;
  const tooLarge = files.find((file) => file.size > MAX_PHOTO_BYTES);
  if (tooLarge) return `${tooLarge.name}: file must be 5MB or smaller.`;
  return null;
}

async function processReviewPhoto(file: File): Promise<Blob> {
  const source = await decodeReviewPhoto(file);
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    source.close();
    throw new Error('Could not process this image.');
  }
  context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  source.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not compress this image.')),
      'image/webp',
      0.82,
    ),
  );
}

async function decodeReviewPhoto(file: File): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not decode this image.'));
      element.src = objectUrl;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
