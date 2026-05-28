import React, { useState } from "react";

const EditPropertyForm = ({ property, onUpdate, onClose }) => {
  // 1. אתחול המצב (State) עם הנתונים המקוריים של הדירה
  const [formData, setFormData] = useState({
    street: property.street || "",
    city: property.city || "",
    price: property.price || 0,
    rooms: property.rooms || 0,
    floor: property.floor || 0,
    size: property.size || 0,
    type: property.type || "Sale",
  });

  // 2. פונקציה שמעדכנת את הנתונים בכל פעם שהמשתמש מקליד בשדות
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };
  const handleSubmit = (e) => {
    e.preventDefault(); 
    onUpdate(property._id, formData); 
  };

  return (
    <form onSubmit={handleSubmit} className="property-form">
      <h2>Edit Property Details</h2>

      <div>
        <label>Street:</label>
        <input
          type="text"
          name="street"
          value={formData.street}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label>City:</label>
        <input
          type="text"
          name="city"
          value={formData.city}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label>Price (₪):</label>
        <input
          type="number"
          name="price"
          value={formData.price}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label>Rooms:</label>
        <input
          type="number"
          name="rooms"
          value={formData.rooms}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label>Floor:</label>
        <input
          type="number"
          name="floor"
          value={formData.floor}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label>Size (sqm):</label>
        <input
          type="number"
          name="size"
          value={formData.size}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label>Type:</label>
        <select name="type" value={formData.type} onChange={handleChange}>
          <option value="Sale">Sale</option>
          <option value="Rent">Rent</option>
        </select>
      </div>

      <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
        <button type="submit" className="submit-btn">
          Save Changes
        </button>
        <button type="button" onClick={onClose} className="cancel-btn">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EditPropertyForm;
