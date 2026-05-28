import React from "react";

const PropertyCard = ({ property, onDelete, onEdit }) => {
  return (
    <div className="property-card">
      {property.img && (
        <img src={property.img} alt="Property" className="property-image" />
      )}

      <div className="card-content">
        <h2>
          {property.street}, {property.city}
        </h2>

        <p className="price">₪{property.price.toLocaleString()}</p>

        <div className="details">
          <span>{property.rooms} rooms</span> |
          <span> floor {property.floor}</span> |
          <span> {property.size} sqm</span>
        </div>

        <span className="type">{property.type}</span>

        <button className="delete-btn" onClick={() => onDelete(property._id)}>
          Delete Property
        </button>

        <button className="edit-btn" onClick={() => onEdit(property)}>
          Edit Property
        </button>
      </div>
    </div>
  );
};

export default PropertyCard;
