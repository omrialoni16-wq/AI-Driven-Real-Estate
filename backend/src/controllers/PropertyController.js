import {
  fetchAllProperties,
  createProperty,
  deleteProperty,
  editProperty,
  filterPropertiesService
} from "../service/PropertyService.js";

export const getAllProperties = async (req, res) => {
  try {
    const properties = await fetchAllProperties();
    res.status(200).json(properties);
  } catch (error) {
    console.error("Error in controller", error);
    res
      .status(500)
      .json({ message: "Server Error: Could not fetch properties" });
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


/**
 * HTTP Controller for property search operations.
 */
export const getPropertiesByFilter = async (req, res) => {
  try {
    // Senior Choice: Extract parameters from query string (GET requests)
    // E.g., /api/properties/search?city=Tel+Aviv&minPrice=3000
    const filterPayload = req.query;

    // Delegate business logic entirely to the service layer
    const properties = await filterPropertiesService(filterPayload);

    // Return an explicit, structured standard JSON response
    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    // Contextual system logging for developers (internal metrics/monitoring)
    console.error(`[PropertyController][getPropertiesByFilter] Error:`, {
      query: req.query,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    // Elegant error handling: Don't leak raw DB queries or stack traces to the client
    return res.status(500).json({
      success: false,
      message:
        "An internal server error occurred while retrieving properties. Please try again later.",
    });
  }
};