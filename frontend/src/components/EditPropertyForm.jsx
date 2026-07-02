import React, { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";

const EditPropertyForm = ({ property, onUpdate, onClose }) => {
  const [formData, setFormData] = useState({
    street: property.street || "",
    city: property.city || "",
    price: property.price || 0,
    rooms: property.rooms || 0,
    floor: property.floor || 0,
    size: property.size || 0,
    type: property.type || PROPERTY_TYPES[0],
  });

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="edit-street">רחוב</Label>
        <Input
          id="edit-street"
          type="text"
          name="street"
          value={formData.street}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-city">עיר</Label>
        <Input
          id="edit-city"
          type="text"
          name="city"
          value={formData.city}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-price">מחיר (₪)</Label>
        <Input
          id="edit-price"
          type="number"
          name="price"
          value={formData.price}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="edit-rooms">חדרים</Label>
          <Input
            id="edit-rooms"
            type="number"
            name="rooms"
            value={formData.rooms}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-floor">קומה</Label>
          <Input
            id="edit-floor"
            type="number"
            name="floor"
            value={formData.floor}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-size">שטח (מ״ר)</Label>
          <Input
            id="edit-size"
            type="number"
            name="size"
            value={formData.size}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>סוג נכס</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2 flex gap-3">
        <Button type="submit" className="flex-1">
          שמור שינויים
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
        >
          ביטול
        </Button>
      </div>
    </form>
  );
};

export default EditPropertyForm;
