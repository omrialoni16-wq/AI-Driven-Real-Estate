import {
  createProperty,
  deleteProperty,
  editProperty,
  filterPropertiesService,
  fetchPropertiesWithPagination,
} from "../service/PropertyService.js";

export const getAllProperties = async (req, res) => {
  try {
    const { page = 1, limit = 21, city, maxPrice, type } = req.query;

    const filters = {
      city: city || "",
      maxPrice: maxPrice || "",
      type: type || "All",
    };

    const result = await fetchPropertiesWithPagination(filters, page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getAllProperties controller", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Could not fetch properties",
      error: error.message,
    });
  }
};

export const addProperty = async (req, res) => {
  try {
    const propertyData = req.body;
    const savedPropertyController = await createProperty(propertyData);
    res.status(201).json(savedPropertyController);
  } catch (error) {
    console.error("Error adding property:", error);
    res.status(400).json({
      message: "Error adding property. Check your data.",
      error: error.message,
    });
  }
};

export const updateProperty = async (req, res) => {
  try {
    const propertyId = req.params.id;
    const updatedData = req.body;

    const updatedProperty = await editProperty(propertyId, updatedData);

    if (!updatedProperty) {
      return res.status(404).json({ message: "No property found!" });
    }
    res.status(200).json(updatedProperty);
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({
      message: "Error updating property",
      error: error.message,
    });
  }
};

export const removeProperty = async (req, res) => {
  try {
    const propertyId = req.params.id;
    const deletedProperty = await deleteProperty(propertyId);

    if (!deletedProperty) {
      return res.status(404).json({ message: "Property not found" });
    }
    res
      .status(200)
      .json({ message: "Property deleted successfully!", deletedProperty });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ message: "Error occurred", error: error.message });
  }
};

export const getPropertiesByFilter = async (req, res) => {
  try {
    const filterPayload = req.query;

    const properties = await filterPropertiesService(filterPayload);

    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error(`[PropertyController][getPropertiesByFilter] Error:`, {
      query: req.query,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      message:
        "An internal server error occurred while retrieving properties. Please try again later.",
    });
  }
};
