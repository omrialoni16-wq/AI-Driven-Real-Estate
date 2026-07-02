import { Search, Banknote } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";

const FilterBar = ({ filters, setFilters }) => {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          name="city"
          placeholder="חיפוש לפי עיר…"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          className="ps-9"
        />
      </div>

      <div className="relative flex-1">
        <Banknote className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="number"
          name="maxPrice"
          placeholder="מחיר מקסימלי…"
          value={filters.maxPrice}
          onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
          className="ps-9"
        />
      </div>

      <Select
        value={filters.type}
        onValueChange={(value) => setFilters({ ...filters, type: value })}
      >
        <SelectTrigger className="sm:w-56">
          <SelectValue placeholder="כל הסוגים" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">כל הסוגים</SelectItem>
          {PROPERTY_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default FilterBar;
