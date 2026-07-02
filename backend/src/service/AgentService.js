import Property from "../models/Property.js";
import { filterPropertiesService } from "./PropertyService.js";

const DEFAULT_IMG =
  "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg";

// ─── Private helpers ──────────────────────────────────────────────────────────

function confidenceLevel(count) {
  return count >= 10 ? "high" : count >= 3 ? "medium" : "low";
}

function formatGroup(result) {
  const avgPricePerSqm =
    result.avgSize > 0 ? Math.round(result.avg / result.avgSize) : null;
  return {
    count: result.count,
    avg: Math.round(result.avg),
    min: result.min,
    max: result.max,
    avgPricePerSqm,
    confidence: confidenceLevel(result.count),
  };
}

// ─── addProperty tool ─────────────────────────────────────────────────────────

export const agentAddProperty = async (args) => {
  const saved = await Property.create({
    ...args,
    img: DEFAULT_IMG,
    description: `דירת ${args.rooms} חדרים ב${args.city}, ברחוב ${args.street}.`,
  });
  return { status: "success", propertyId: String(saved._id) };
};

// ─── searchPrices tool ────────────────────────────────────────────────────────

export const agentSearchPrices = async ({ city, type, rooms }) => {
  const match = {};
  if (city?.trim()) match.city = { $regex: new RegExp(city.trim(), "i") };
  if (type?.trim()) match.type = type.trim();
  if (rooms != null) {
    const r = Number(rooms);
    match.rooms = { $gte: r - 1, $lte: r + 1 };
  }

  if (!type?.trim()) {
    const groups = await Property.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$type",
          avg: { $avg: "$price" },
          min: { $min: "$price" },
          max: { $max: "$price" },
          avgSize: { $avg: "$size" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    if (!groups.length) return { count: 0, matchCriteria: { city, rooms } };

    const meaningful = groups.filter((g) => g.count >= 3).slice(0, 5);

    if (!meaningful.length) return { count: 0, matchCriteria: { city, rooms } };

    const byType = Object.fromEntries(
      meaningful.map((g) => [g._id, formatGroup(g)]),
    );
    const totalCount = meaningful.reduce((s, g) => s + g.count, 0);

    return { byType, totalCount, matchCriteria: { city, rooms } };
  }

  const [result] = await Property.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        avg: { $avg: "$price" },
        min: { $min: "$price" },
        max: { $max: "$price" },
        avgSize: { $avg: "$size" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (!result || result.count === 0) {
    return { count: 0, matchCriteria: { city, type, rooms } };
  }

  return {
    ...formatGroup(result),
    matchCriteria: {
      city,
      type,
      rooms:
        rooms != null ? `${Number(rooms) - 1}–${Number(rooms) + 1}` : "any",
    },
  };
};

// ─── searchProperties tool ────────────────────────────────────────────────────

export const agentSearchProperties = async (filters) => {
  const results = await filterPropertiesService(filters);
  const properties = results.slice(0, 5).map((p) => ({
    id: p._id,
    city: p.city,
    street: p.street,
    price: p.price,
    rooms: p.rooms,
    size: p.size,
    type: p.type,
  }));
  return { count: results.length, properties };
};
