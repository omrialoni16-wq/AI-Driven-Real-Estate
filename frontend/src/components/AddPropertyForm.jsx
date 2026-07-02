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

const INITIAL = {
  street: "",
  city: "",
  price: "",
  rooms: "",
  floor: "",
  size: "",
  type: PROPERTY_TYPES[0],
  img: "",
};

const AddPropertyForm = ({ onAdd }) => {
  const [formData, setFormData] = useState(INITIAL);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    setFormData(INITIAL);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="add-street">רחוב</Label>
        <Input
          id="add-street"
          type="text"
          name="street"
          placeholder="לדוגמה: הרצל 12"
          value={formData.street}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="add-city">עיר</Label>
        <Input
          id="add-city"
          type="text"
          name="city"
          placeholder="לדוגמה: תל אביב"
          value={formData.city}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="add-price">מחיר (₪)</Label>
        <Input
          id="add-price"
          type="number"
          name="price"
          placeholder="1500000"
          value={formData.price}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="add-rooms">חדרים</Label>
          <Input
            id="add-rooms"
            type="number"
            name="rooms"
            placeholder="3"
            value={formData.rooms}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="add-floor">קומה</Label>
          <Input
            id="add-floor"
            type="number"
            name="floor"
            placeholder="2"
            value={formData.floor}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="add-size">שטח (מ״ר)</Label>
          <Input
            id="add-size"
            type="number"
            name="size"
            placeholder="90"
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

      <div className="grid gap-2">
        <Label htmlFor="add-img">קישור לתמונה</Label>
        <Input
          id="add-img"
          type="text"
          name="img"
          placeholder="https://…"
          value={formData.img}
          onChange={handleChange}
          required
        />
      </div>

      <Button type="submit" size="lg" className="mt-2">
        פרסום נכס
      </Button>
    </form>
  );
};

export default AddPropertyForm;
