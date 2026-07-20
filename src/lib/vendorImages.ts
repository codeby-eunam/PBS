import { supabase } from './supabase';

const BUCKET = 'vendor-images';
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type VendorImageResult = { imagePath: string; publicUrl: string };

export async function uploadVendorImage(
  vendorId: string,
  oldPath: string | null,
  file: File,
): Promise<VendorImageResult> {
  const extension = EXTENSIONS[file.type];
  if (!extension) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > MAX_BYTES) throw new Error('The image must be 5 MB or smaller.');

  const imagePath = `${vendorId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('vendors')
    .update({ image_path: imagePath })
    .eq('id', vendorId)
    .select('image_path')
    .single();
  if (updateError) {
    await supabase.storage.from(BUCKET).remove([imagePath]);
    throw updateError;
  }

  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
  return {
    imagePath,
    publicUrl: supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl,
  };
}

export async function deleteVendorImage(vendorId: string, imagePath: string) {
  const { error: updateError } = await supabase
    .from('vendors')
    .update({ image_path: null })
    .eq('id', vendorId)
    .select('image_path')
    .single();
  if (updateError) throw updateError;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([imagePath]);
  if (storageError) throw storageError;
}
