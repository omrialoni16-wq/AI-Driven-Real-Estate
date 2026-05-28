import React from "react";

const FilterBar = ({ filters, setFilters }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  return (
    <div className="filter-bar">
      <input
        type="text"
        name="city"
        placeholder="Search by city..."
        value={filters.city}
        onChange={handleChange}
        className="filter-input"
      />

      <input
        type="number"
        name="maxPrice"
        placeholder="Enter a price... "
        value={filters.maxPrice}
        onChange={handleChange}
        className="filter-input"
      />

      <select
        name="type"
        value={filters.type}
        onChange={handleChange}
        className="filter-input"
      >
        <option value="All">All Types</option>
        <option value="דירה">Apartment (דירה)</option>
        <option value="פנטהאוז">Penthouse</option>
        <option value="בית">House</option>
      </select>
    </div>
  );
};

export default FilterBar;
