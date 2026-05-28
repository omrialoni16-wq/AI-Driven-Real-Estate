import React, { useState } from "react";

const AddPropertyForm = ({ onAdd }) => {
  const [formData, setFormData] = useState({
    street: "",
    city: "",
    price: "",
    rooms: "",
    floor: "",
    size: "",
    type: "Apartment",
    img: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({
      street: "",
      city: "",
      price: "",
      rooms: "",
      floor: "",
      size: "",
      type: "Apartment",
      img: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="add-property-form">
      <h3>Add New Property</h3>

      <input
        type="text"
        name="street"
        placeholder="Street"
        value={formData.street}
        onChange={handleChange}
        required
      />
      <input
        type="text"
        name="city"
        placeholder="City"
        value={formData.city}
        onChange={handleChange}
        required
      />
      <input
        type="number"
        name="price"
        placeholder="Price (₪)"
        value={formData.price}
        onChange={handleChange}
        required
      />

      <div className="form-row">
        <input
          type="number"
          name="rooms"
          placeholder="Rooms"
          value={formData.rooms}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="floor"
          placeholder="Floor"
          value={formData.floor}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="size"
          placeholder="Size (sqm)"
          value={formData.size}
          onChange={handleChange}
          required
        />
      </div>

      <select name="type" value={formData.type} onChange={handleChange}>
        <option value="Apartment">Apartment</option>
        <option value="Penthouse">Penthouse</option>
        <option value="House">House</option>
      </select>

      <input
        type="text"
        name="img"
        placeholder="Image URL"
        value={formData.img}
        onChange={handleChange}
        required
      />

      <button type="submit" className="submit-btn">
        Publish Property
      </button>
    </form>
  );
};

export default AddPropertyForm;
