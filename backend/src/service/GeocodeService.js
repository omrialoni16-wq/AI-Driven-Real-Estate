const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_TIMEOUT_MS = 5000;

// Nominatim's usage policy requires an identifying User-Agent or requests get blocked.
// Requires Node >= 18 for global fetch.
export const geocodeAddress = async (street, city) => {
  const params = new URLSearchParams({
    street,
    city,
    country: "Israel",
    format: "jsonv2",
    limit: "1",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": "RealEstateApp/1.0 (omrialoni16@gmail.com)",
        "Accept-Language": "he",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("Geocoding request failed", { street, city, status: response.status });
      return null;
    }

    const results = await response.json();
    const match = results?.[0];
    if (!match) {
      console.error("Geocoding found no match", { street, city });
      return null;
    }

    return { lat: Number(match.lat), lng: Number(match.lon) };
  } catch (error) {
    console.error("Error geocoding address", { street, city, error: error.message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
