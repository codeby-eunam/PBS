import { useCallback, useMemo, useRef, useState } from "react";
import { getVendorReviews } from "../lib/reviews";
import type { CommunityPhoto, ReviewWithPhotos } from "../types";

export function useVendorReviews() {
  const [reviews, setReviews] = useState<ReviewWithPhotos[]>([]);
  const [errors, setErrors] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const requestCount = useRef(0);

  const load = useCallback(async (vendorIds: string[]) => {
    const ids = [...new Set(vendorIds.filter(Boolean))];
    if (!ids.length)
      return { succeeded: [] as string[], failed: [] as string[] };
    requestCount.current += 1;
    setLoading(true);
    const results = await Promise.allSettled(ids.map(getVendorReviews));
    const succeeded: string[] = [];
    const failed: string[] = [];
    const loaded: ReviewWithPhotos[] = [];

    results.forEach((result, index) => {
      const id = ids[index];
      if (result.status === "fulfilled") {
        succeeded.push(id);
        loaded.push(...result.value);
      } else {
        failed.push(id);
      }
    });

    setReviews((current) => [
      ...current.filter((review) => !succeeded.includes(review.vendor_id)),
      ...loaded,
    ]);
    setErrors((current) => {
      const next = new Set(current);
      succeeded.forEach((id) => next.delete(id));
      failed.forEach((id) => next.add(id));
      return next;
    });
    requestCount.current -= 1;
    setLoading(requestCount.current > 0);
    return { succeeded, failed };
  }, []);

  const refresh = useCallback(
    async (vendorId: string) => {
      const result = await load([vendorId]);
      if (result.failed.includes(vendorId))
        throw new Error("Could not load reviews.");
    },
    [load],
  );

  const photos = useMemo<CommunityPhoto[]>(
    () =>
      reviews.flatMap((review) =>
        review.photos.map((photo) => ({
          vendorId: review.vendor_id,
          reviewId: review.id,
          imageUrl: photo.public_url,
          createdAt: new Date(photo.created_at).getTime(),
        })),
      ),
    [reviews],
  );

  return { reviews, photos, loading, errors, load, refresh };
}
