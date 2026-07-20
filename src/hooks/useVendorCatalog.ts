import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVendorBatch, getVendorCount } from "../lib/vendors";
import type { Vendor } from "../types";

const PAGE_SIZE = 50;

export function nextVendorPage(
  offset: number,
  total: number,
  pageSize = PAGE_SIZE,
) {
  return { offset, limit: Math.max(0, Math.min(pageSize, total - offset)) };
}

function mergeVendors(current: Vendor[], incoming: Vendor[]): Vendor[] {
  const merged = new Map(current.map((vendor) => [vendor.id, vendor]));
  incoming.forEach((vendor) => merged.set(vendor.id, vendor));
  return [...merged.values()];
}

export function useVendorCatalog() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const requestInFlight = useRef(false);

  const loadPage = useCallback(async (from: number) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (from > 0) setLoadingMore(true);
    try {
      const batch = await getVendorBatch(from, PAGE_SIZE);
      setVendors((current) =>
        from === 0 ? batch.vendors : mergeVendors(current, batch.vendors),
      );
      setOffset(from + batch.rawCount);
      setError(false);
    } catch {
      setError(true);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getVendorCount()
      .then((count) => {
        if (!active) return;
        setTotal(count);
        return loadPage(0);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (offset < total) void loadPage(offset);
  }, [loadPage, offset, total]);

  const setVendorImage = useCallback(
    (vendorId: string, imagePath: string | null, featuredImageUrl?: string) => {
      setVendors((current) =>
        current.map((vendor) =>
          vendor.id === vendorId
            ? { ...vendor, imagePath, featuredImageUrl }
            : vendor,
        ),
      );
    },
    [],
  );

  const vendorMap = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors],
  );

  return {
    vendors,
    vendorMap,
    total,
    offset,
    loading,
    loadingMore,
    error,
    loadMore,
    setVendorImage,
  };
}
