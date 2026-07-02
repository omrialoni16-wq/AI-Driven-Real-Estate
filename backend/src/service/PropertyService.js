import Property from "../models/Property.js";

export const fetchPropertiesWithPagination = async (
  filters = {},
  page = 1,
  limit = 21,
) => {
  try {
    const query = {};

    const { city, maxPrice, type } = filters;
    if (city?.trim()) {
      query.city = { $regex: new RegExp(city.trim(), "i") };
    }

    if (type?.trim() && type !== "All") {
      query.type = type.trim();
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 21);
    const maxProperties = 300;
    const skip = (pageNum - 1) * limitNum;
    const adjustedLimit = Math.min(limitNum, maxProperties - skip);

    const priceFilter =
      maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : null;

    const priceStages = priceFilter
      ? [
          { $addFields: { priceAsNumber: { $toDouble: "$price" } } },
          { $match: { priceAsNumber: { $lte: priceFilter } } },
        ]
      : [];

    const [countResult, properties] = await Promise.all([
      Property.aggregate([
        { $match: query },
        ...priceStages,
        { $count: "total" },
      ]),
      Property.aggregate([
        { $match: query },
        ...priceStages,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: adjustedLimit },
        { $unset: "embedding" },
      ]),
    ]);

    const totalProperties = Math.min(countResult[0]?.total ?? 0, maxProperties);
    const totalPages = Math.ceil(totalProperties / limitNum);

    return {
      properties,
      totalProperties,
      totalPages,
      currentPage: pageNum,
    };
  } catch (error) {
    console.error("Error fetching properties with pagination:", error);
    throw error;
  }
};

export const createProperty = async (propertyData) => {
  try {
    const newProperty = new Property(propertyData);
    const savedProperty = await newProperty.save();
    return savedProperty;
  } catch (error) {
    console.error("Error creating property!:", error);
    throw error;
  }
};

export const deleteProperty = async (id) => {
  try {
    const deletedProperty = await Property.findByIdAndDelete(id);
    return deletedProperty;
  } catch (error) {
    console.error("Failed deleting Property!:", error);
    throw error;
  }
};

export const editProperty = async (id, updatedData) => {
  try {
    const updatedProperty = await Property.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });
    return updatedProperty;
  } catch (error) {
    console.error("Failed updating Property!:", error);
    throw error;
  }
};

export const filterPropertiesService = async (filters = {}) => {
  const query = {};

  const {
    city,
    type,
    minPrice,
    maxPrice,
    rooms,
    floor,
    minSize,
    maxSize,
    tags,
  } = filters || {};
  if (city?.trim()) {
    query.city = { $regex: new RegExp(city.trim(), "i") };
  }

  if (type?.trim() && type !== "All") {
    query.type = type.trim();
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined && minPrice !== "")
      query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== "")
      query.price.$lte = Number(maxPrice);
    if (Object.keys(query.price).length === 0) delete query.price;
  }

  if (minSize !== undefined || maxSize !== undefined) {
    query.size = {};
    if (minSize !== undefined && minSize !== "")
      query.size.$gte = Number(minSize);
    if (maxSize !== undefined && maxSize !== "")
      query.size.$lte = Number(maxSize);
    if (Object.keys(query.size).length === 0) delete query.size;
  }

  if (rooms !== undefined && rooms !== "") query.rooms = Number(rooms);
  if (floor !== undefined && floor !== "") query.floor = Number(floor);

  if (Array.isArray(tags) && tags.length > 0) {
    query.tags = { $all: tags };
  }

  return await Property.find(query)
    .select("-embedding")
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();
};
