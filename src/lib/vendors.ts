import { supabase } from "./supabase";
import type { LineStatus, Vendor, VendorType } from "../types";

const VENDOR_IMAGE_BUCKET = "vendor-images";

export async function getVendorGalleryImages(vendor: Vendor): Promise<string[]> {
  const known = vendor.galleryImageUrls ?? (vendor.featuredImageUrl ? [vendor.featuredImageUrl] : []);
  const folder = vendor.imagePath?.includes("/")
    ? vendor.imagePath.slice(0, vendor.imagePath.lastIndexOf("/"))
    : vendor.id;
  const { data, error } = await supabase.storage
    .from(VENDOR_IMAGE_BUCKET)
    .list(folder, { limit: 20, sortBy: { column: "name", order: "asc" } });
  if (error) return known;
  const stored = (data ?? [])
    .filter((item) => item.name && item.metadata)
    .map((item) =>
      supabase.storage.from(VENDOR_IMAGE_BUCKET).getPublicUrl(`${folder}/${item.name}`).data.publicUrl,
    );
  return [...known, ...stored].filter((url, index, urls) => urls.indexOf(url) === index);
}

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
  accent_color: string;
  accent_color_source: string;
  location_name: string | null;
  booth_number: string | null;
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
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
    const merge = (left: string[] = [], right: string[] = []) => [
      ...new Set([...left, ...right]),
    ];
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
    accentColor: row.accent_color,
    accentColorSource: row.accent_color_source as Vendor["accentColorSource"],
    locationName: row.location_name,
    boothNumber: row.booth_number,
    zone: row.zone,
    latitude: row.latitude,
    longitude: row.longitude,
    featuredImageUrl: row.image_path
      ? supabase.storage.from(VENDOR_IMAGE_BUCKET).getPublicUrl(row.image_path)
          .data.publicUrl
      : undefined,
  }));
}

async function attachGalleryImages(vendors: Vendor[]) {
  if (!vendors.length) return vendors;
  const { data, error } = await supabase
    .from("vendor_photos")
    .select("vendor_id,storage_path,sort_order")
    .in(
      "vendor_id",
      vendors.map((vendor) => vendor.id),
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  // The gallery migration is additive. Keep the catalog working before it is applied.
  if (error) return vendors;
  const urls = new Map<string, string[]>();
  for (const photo of data ?? []) {
    const current = urls.get(photo.vendor_id) ?? [];
    current.push(
      supabase.storage
        .from(VENDOR_IMAGE_BUCKET)
        .getPublicUrl(photo.storage_path).data.publicUrl,
    );
    urls.set(photo.vendor_id, current);
  }
  return vendors.map((vendor) => ({
    ...vendor,
    galleryImageUrls: [
      ...(vendor.featuredImageUrl ? [vendor.featuredImageUrl] : []),
      ...(urls.get(vendor.id) ?? []),
    ].filter((url, index, all) => all.indexOf(url) === index),
  }));
}

export async function getVendorCount(): Promise<number> {
  const { count, error } = await supabase
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

export async function getVendorBatch(
  offset: number,
  limit: number,
): Promise<{ vendors: Vendor[]; rawCount: number }> {
  if (limit <= 0) return { vendors: [], rawCount: 0 };
  const rows: VendorRow[] = [];
  const requestSize = 100;
  while (rows.length < limit) {
    const from = offset + rows.length;
    const size = Math.min(requestSize, limit - rows.length);
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    const page = (data ?? []) as VendorRow[];
    rows.push(...page);
    if (page.length < size) break;
  }
  return {
    vendors: await attachGalleryImages(mapRows(rows)),
    rawCount: rows.length,
  };
}
