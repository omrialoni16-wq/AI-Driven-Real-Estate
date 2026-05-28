import { useState, useEffect } from "react";
import axios from "axios";
import PropertyCard from "./components/PropertyCard";
import AddPropertyForm from "./components/AddPropertyForm";
import FilterBar from "./components/FilterBar";
import Pagination from "./components/Pagination";
import AIChat from "./components/AIChat";
import "./App.css";
import EditPropertyForm from "./components/EditPropertyForm";

function App() {
  const [properties, setProperties] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  const [filters, setFilters] = useState({
    city: "",
    maxPrice: "",
    type: "All",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const propertiesPerPage = 21;
  const [isLoading, setIsLoading] = useState(true);

  // --- 1. Fetch ALL Properties (Fallback / Reset) ---
  const fetchProperties = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://localhost:5000/api/properties");
      // Fallback configuration based on your API structure
      const propertiesData = response.data.data || response.data;
      setProperties(propertiesData);
      setIsModalOpen(false);
    } catch (error) {
      console.error("failed to fetch properties", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Fetch FILTERED Properties (Your new explicit function) ---
  const fetchFilteredProperties = async () => {
    setIsLoading(true);
    try {
      const queryParams = {};
      if (filters.city.trim()) queryParams.city = filters.city;
      if (filters.maxPrice) queryParams.maxPrice = filters.maxPrice;
      if (filters.type !== "All") queryParams.type = filters.type;

      const response = await axios.get(
        "http://localhost:5000/api/search",
        {
          params: queryParams,
        },
      );

      const propertiesData = response.data.data || response.data;

      setProperties(propertiesData);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to fetch filtered properties", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. The Debounced Filtering Trigger ---
  useEffect(() => {
    setCurrentPage(1); // Reset pagination on new search criteria

    const delayDebounceFn = setTimeout(() => {
      // FIX: Call your new filter function here, not the unfiltered one!
      fetchFilteredProperties();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // --- 4. Database Mutators ---
  const handleDelete = async (propertyId) => {
    const isConfirmed = window.confirm(
      "Are you sure you want to delete this property?",
    );
    if (isConfirmed) {
      try {
        await axios.delete(
          `http://localhost:5000/api/properties/${propertyId}`,
        );
        setProperties(
          properties.filter((property) => property._id !== propertyId),
        );
      } catch (error) {
        console.error("Error deleting property:", error);
        alert("Could not delete property. Please try again.");
      }
    }
  };

  const handleAddProperty = async (newPropertyData) => {
    try {
      await axios.post("http://localhost:5000/api/properties", newPropertyData);
      fetchFilteredProperties(); // Sync state back up with active filters
      alert("Property added successfully!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed adding property:", error);
      alert("Could not add property. Check server console.");
    }
  };

  const handleEditProperty = async (id, updatedData) => {
    try {
      await axios.put(
        `http://localhost:5000/api/properties/${id}`,
        updatedData,
      );
      fetchFilteredProperties(); // Sync state back up with active filters
      setEditingProperty(null);
    } catch (error) {
      console.error("Error updating property in React:", error);
    }
  };

  // --- 5. Frontend UI Pagination Calculations ---
  // FIX: Read directly from the `properties` array now populated by your backend
  const indexOfLastProperty = currentPage * propertiesPerPage;
  const indexOfFirstProperty = indexOfLastProperty - propertiesPerPage;
  const currentProperties = properties.slice(
    indexOfFirstProperty,
    indexOfLastProperty,
  );

  return (
    <div className="app-container">
      <h1>My Property Listings</h1>

      <FilterBar filters={filters} setFilters={setFilters} />

      {/* Passed updated logic references down to the AI Chat component */}
      <AIChat onActionCompleted={fetchFilteredProperties} />

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-modal-btn"
              onClick={() => setIsModalOpen(false)}
            >
              ✖
            </button>
            <AddPropertyForm onAdd={handleAddProperty} />
          </div>
        </div>
      )}

      {editingProperty && (
        <div className="modal-overlay" onClick={() => setEditingProperty(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-modal-btn"
              onClick={() => setEditingProperty(null)}
            >
              ✖
            </button>
            <EditPropertyForm
              property={editingProperty}
              onUpdate={handleEditProperty}
              onClose={() => setEditingProperty(null)}
            />
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setIsModalOpen(true)}>
        +
      </button>

      {isLoading ? (
        <div className="loading-message">
          <h2>Loading properties... ⏳</h2>
        </div>
      ) : (
        <div className="properties-grid">
          {currentProperties && currentProperties.length > 0 ? (
            currentProperties.map((item) => (
              <PropertyCard
                key={item._id}
                property={item}
                onDelete={handleDelete}
                onEdit={(propertyToEdit) => setEditingProperty(propertyToEdit)}
              />
            ))
          ) : (
            <p>No properties match your filters.</p>
          )}
        </div>
      )}

      {/* FIX: Total properties count must reference properties.length */}
      <Pagination
        propertiesPerPage={propertiesPerPage}
        totalProperties={properties.length}
        paginate={setCurrentPage}
        currentPage={currentPage}
      />
    </div>
  );
}

export default App;
