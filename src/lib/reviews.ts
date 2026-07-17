import { supabase } from './supabase';
import type { Review, ReviewInput, ReviewPhoto, ReviewWithPhotos } from '../types';

const PHOTO_BUCKET = 'community-photos';

export async function getVendorReviews(vendorId: string): Promise<ReviewWithPhotos[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, review_photos(*)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { review_photos: photoRows, ...review } = row as Review & {
      review_photos: ReviewPhoto[] | null;
    };
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

export async function createReview(
  vendorId: string,
  userId: string,
  input: ReviewInput,
): Promise<Review> {
  const { data, error } = await supabase.from('reviews').insert({
    vendor_id: vendorId,
    user_id: userId,
    ...input,
  }).select('*').single();
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
  userId: string,
): Promise<void> {
  const { data: photos, error: photoLookupError } = await supabase
    .from('review_photos')
    .select('storage_path')
    .eq('review_id', reviewId)
    .eq('user_id', userId);
  if (photoLookupError) throw photoLookupError;

  const paths = (photos ?? []).map((photo) => photo.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(paths);
    if (storageError) throw storageError;

    const { error: photoDeleteError } = await supabase
      .from('review_photos')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId);
    if (photoDeleteError) throw photoDeleteError;
  }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadReviewPhoto(
  reviewId: string,
  vendorId: string,
  userId: string,
  file: File,
): Promise<string> {
  const processed = await processReviewPhoto(file);
  const storagePath = `${userId}/${vendorId}/${reviewId}/${Date.now()}-${crypto.randomUUID()}.webp`;
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

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateReviewPhotos(files: File[]): string | null {
  if (files.length > 3) return 'You can attach up to 3 photos.';
  const invalidType = files.find((file) => !ALLOWED_PHOTO_TYPES.has(file.type));
  if (invalidType) return `${invalidType.name}: unsupported file type.`;
  const tooLarge = files.find((file) => file.size > MAX_PHOTO_BYTES);
  if (tooLarge) return `${tooLarge.name}: file must be 5MB or smaller.`;
  return null;
}

async function processReviewPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process this image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not compress this image.')),
      'image/webp',
      0.82,
    ),
  );
}
