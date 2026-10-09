import { useState, useEffect } from 'react';

// In-memory cache for fast instant lookup
const memoryCache = new Map<string, string>();

// Request queue to throttle Nominatim requests (1 request per 1.1s to respect OSM policies)
type QueueItem = {
  lat: number;
  lng: number;
  cacheKey: string;
  resolve: (address: string) => void;
};

const queue: QueueItem[] = [];
let isProcessingQueue = false;

// Helper to format full detailed address matching GPSwox
function formatFullAddress(data: any): string {
  if (!data) return '';

  if (data.address) {
    const addr = data.address;

    // 1. Street / Road with house number if present
    const streetNum = addr.house_number || addr.building || '';
    const streetName =
      addr.road ||
      addr.pedestrian ||
      addr.street ||
      addr.avenue ||
      addr.boulevard ||
      addr.footway ||
      addr.path ||
      addr.cycleway ||
      '';
    const street = [streetNum, streetName].filter(Boolean).join(' ').trim();

    // 2. Neighbourhood / Quarter / Area
    const quarter =
      addr.neighbourhood ||
      addr.quarter ||
      addr.residential ||
      addr.subdivision ||
      addr.hamlet ||
      '';

    // 3. Suburb / Arrondissement / District
    const suburb =
      addr.suburb ||
      addr.city_district ||
      addr.district ||
      addr.borough ||
      addr.subdistrict ||
      '';

    // 4. City / Municipality / Town / Village
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      '';

    // 5. Country
    const country = addr.country || '';

    const candidates = [street, quarter, suburb, city, country].filter(Boolean);

    // Remove duplicates or substrings (case-insensitive) while preserving sequence
    const parts: string[] = [];
    for (const item of candidates) {
      const clean = item.trim();
      if (!clean) continue;
      const lower = clean.toLowerCase();
      // Skip if identical to existing part or an exact substring of an already added part
      const alreadyIncluded = parts.some((p) => {
        const pl = p.toLowerCase();
        return pl === lower || pl.includes(lower);
      });
      if (!alreadyIncluded) {
        parts.push(clean);
      }
    }

    if (parts.length >= 2) {
      return parts.join(', ');
    }
  }

  // Fallback: clean display_name from OSM Nominatim (remove raw postal codes, preserve full locality chain)
  if (data?.display_name) {
    const parts = data.display_name
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => !/^\d{4,6}$/.test(s)); // filter out postal code like 20062
    if (parts.length > 0) {
      return parts.join(', ');
    }
  }

  return '';
}

async function processQueue() {
  if (isProcessingQueue || queue.length === 0) return;
  isProcessingQueue = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    // Double check cache before fetching
    if (memoryCache.has(item.cacheKey)) {
      item.resolve(memoryCache.get(item.cacheKey)!);
      continue;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${item.lat}&lon=${item.lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'fr, ar, en',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        let formatted = formatFullAddress(data);

        if (!formatted) {
          formatted = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
        }

        memoryCache.set(item.cacheKey, formatted);
        try {
          localStorage.setItem(`sftm_full_geo_v2_${item.cacheKey}`, formatted);
        } catch {
          // Ignore localStorage quota errors
        }

        item.resolve(formatted);
      } else {
        const fallback = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
        item.resolve(fallback);
      }
    } catch {
      const fallback = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
      item.resolve(fallback);
    }

    // Wait 1.1s between Nominatim requests
    await new Promise((r) => setTimeout(r, 1100));
  }

  isProcessingQueue = false;
}

function resolveCoordinates(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

  // Check in-memory
  if (memoryCache.has(cacheKey)) {
    return Promise.resolve(memoryCache.get(cacheKey)!);
  }

  // Check localStorage (v2 full format)
  try {
    const saved = localStorage.getItem(`sftm_full_geo_v2_${cacheKey}`);
    if (saved) {
      memoryCache.set(cacheKey, saved);
      return Promise.resolve(saved);
    }
  } catch {
    // Ignore storage errors
  }

  return new Promise((resolve) => {
    queue.push({ lat, lng, cacheKey, resolve });
    processQueue();
  });
}

function isRawCoordinates(str?: string | null): boolean {
  if (!str) return true;
  const trimmed = str.trim();
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed);
}

function isDetailedAddress(str?: string | null): boolean {
  if (!str) return false;
  if (isRawCoordinates(str)) return false;
  // Check if it already has rich multi-segment details (at least 2 commas)
  const segments = str.split(',').map((s) => s.trim()).filter(Boolean);
  return segments.length >= 1;
}

export function useVehicleAddress(lat?: number | null, lng?: number | null, initialCity?: string | null) {
  const hasValidCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
  const hasCompleteAddress = isDetailedAddress(initialCity);
  const hasBasicAddress = initialCity && !isRawCoordinates(initialCity);

  const [address, setAddress] = useState<string>(() => {
    if (hasCompleteAddress) return initialCity!;
    if (hasValidCoords) {
      const key = `${lat!.toFixed(4)}_${lng!.toFixed(4)}`;
      if (memoryCache.has(key)) return memoryCache.get(key)!;
      try {
        const saved = localStorage.getItem(`sftm_full_geo_v2_${key}`);
        if (saved) return saved;
      } catch {
        // ignore
      }
      return `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`;
    }
    return initialCity || 'Localisation indisponible';
  });

  const [isLoading, setIsLoading] = useState<boolean>(!hasCompleteAddress && hasValidCoords);

  useEffect(() => {
    if (hasCompleteAddress) {
      setAddress(initialCity!);
      setIsLoading(false);
      return;
    }

    if (!hasValidCoords) {
      setAddress(initialCity || 'Position inconnue');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    resolveCoordinates(lat!, lng!).then((resolved) => {
      if (isMounted) {
        setAddress(resolved);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [lat, lng, initialCity, hasCompleteAddress, hasValidCoords]);

  return { address, isLoading };
}
