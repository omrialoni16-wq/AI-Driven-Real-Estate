import Property from "../models/Property.js";

export const fetchAllProperties = async () => {
  try {
    const properties = await Property.find().sort({ _id: -1 }).limit(300);
    return properties;
  } catch (error) {
    console.error("Error fetching properties:", error);
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

/**
 * Service to handle business logic for filtering properties.
 * If filters are empty or omitted, it gracefully falls back to returning all properties.
 * * @param {Object} filters - Active search criteria from the client
 * @returns {Promise<Array>} - Array of matching or all apartment documents
 */
export const filterPropertiesService = async (filters = {}) => {
  const query = {};
  
  // Destructure safely, fallback to an empty object if filters is null/undefined
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

  // --- 1. Text Searches ---
  if (city?.trim()) {
    query.city = { $regex: new RegExp(city.trim(), "i") };
  }

  // Treat "All" from the frontend as no filter
  if (type?.trim() && type !== "All") {
    query.type = type.trim();
  }

  // --- 2. Numeric Range Queries ---
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

  // --- 3. Exact Numeric Queries ---
  if (rooms !== undefined && rooms !== "") query.rooms = Number(rooms);
  if (floor !== undefined && floor !== "") query.floor = Number(floor);

  // --- 4. Array Matching ---
  if (Array.isArray(tags) && tags.length > 0) {
    query.tags = { $all: tags };
  }

  // Senior Architectural Note:
  // If `query` is completely empty here, `Property.find({})` will fetch everything.
  // We keep the `.limit(100)` to safeguard database performance.
  return await Property.find(query)
    .select("-embedding") // Exclude heavy vectors
    .sort({ createdAt: -1 }) // Newest first
    .limit(300) // Protect server memory from unbounded growth
    .lean(); // Lightweight raw JSON conversion
};
