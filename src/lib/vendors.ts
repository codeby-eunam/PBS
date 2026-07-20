import { supabase } from './supabase';
import type { LineStatus, Vendor, VendorType } from '../types';

const FEATURED_IMAGES: Record<string, string> = {
  'bacon mania': '/vendors/bacon-mania.png',
};
const VENDOR_IMAGE_BUCKET = 'vendor-images';

type VendorRow = {
  id: string;
  name: string;
  vendor_type: VendorType;
  cuisines: string[];
  food_types: string[];
  menu_items: string[];
  dietary_tags: string[];
  description: string | null;
  review_count: number;
  review_snippets: string[];
  line_status: LineStatus;
  instagram_url: string | null;
  source: string;
  is_active: boolean;
  sort_order: number;
  image_path: string | null;
};

function mapRows(rows: VendorRow[]): Vendor[] {
  // Older imports may have created the same vendor under different UUIDs.
  // Keep the first stable row and merge its searchable/detail fields.
  const uniqueRows = new Map<string, VendorRow>();
  for (const row of rows) {
    const key = row.name.trim().toLocaleLowerCase();
    const current = uniqueRows.get(key);
    if (!current) {
      uniqueRows.set(key, row);
      continue;
    }
    const merge = (left: string[] = [], right: string[] = []) => [...new Set([...left, ...right])];
    uniqueRows.set(key, {
      ...current,
      cuisines: merge(current.cuisines, row.cuisines),
      food_types: merge(current.food_types, row.food_types),
      menu_items: merge(current.menu_items, row.menu_items),
      dietary_tags: merge(current.dietary_tags, row.dietary_tags),
      review_snippets: merge(current.review_snippets, row.review_snippets),
      description: current.description ?? row.description,
      review_count: Math.max(current.review_count ?? 0, row.review_count ?? 0),
      line_status: current.line_status ?? row.line_status,
      instagram_url: current.instagram_url ?? row.instagram_url,
    });
  }

  return [...uniqueRows.values()].map((row) => ({
    id: row.id,
    name: row.name,
    vendorType: row.vendor_type,
    cuisines: row.cuisines ?? [],
    foodTypes: row.food_types ?? [],
    menuItems: row.menu_items ?? [],
    dietaryTags: row.dietary_tags ?? [],
    description: row.description,
    reviewCount: row.review_count,
    reviewSnippets: row.review_snippets ?? [],
    lineStatus: row.line_status,
    instagramUrl: row.instagram_url,
    source: row.source,
    isActive: row.is_active,
    imagePath: row.image_path,
    featuredImageUrl: row.image_path
      ? supabase.storage.from(VENDOR_IMAGE_BUCKET).getPublicUrl(row.image_path).data.publicUrl
      : FEATURED_IMAGES[row.name.trim().toLocaleLowerCase()],
  }));
}

export async function getVendorCount(): Promise<number> {
  const { count, error } = await supabase
    .from('vendors')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

export async function getVendorBatch(offset: number, limit: number): Promise<{vendors: Vendor[]; rawCount: number}> {
  if (limit <= 0) return { vendors: [], rawCount: 0 };
  const rows: VendorRow[] = [];
  const requestSize = 100;
  while (rows.length < limit) {
    const from = offset + rows.length;
    const size = Math.min(requestSize, limit - rows.length);
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    const page = (data ?? []) as VendorRow[];
    rows.push(...page);
    if (page.length < size) break;
  }
  return { vendors: mapRows(rows), rawCount: rows.length };
}
