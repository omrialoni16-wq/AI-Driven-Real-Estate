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
  const pills = ["All", ...PROPERTY_TYPES];

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-4 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            name="city"
            placeholder="חיפוש לפי עיר…"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="h-12 rounded-xl bg-secondary/60 pe-11 text-[15px] font-medium"
          />
        </div>

        <div className="relative flex-1">
          <Banknote className="pointer-events-none absolute end-4 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            name="maxPrice"
            placeholder="מחיר מקסימלי…"
            value={filters.maxPrice}
            onChange={(e) =>
              setFilters({ ...filters, maxPrice: e.target.value })
            }
            className="h-12 rounded-xl bg-secondary/60 pe-11 text-[15px] font-medium"
          />
        </div>

        <Select
          value={filters.type}
          onValueChange={(value) => setFilters({ ...filters, type: value })}
        >
          <SelectTrigger className="h-12 rounded-xl bg-secondary/60 font-semibold sm:w-52 [&>span]:font-semibold data-[size]:h-12">
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

      <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border pt-3.5">
        {pills.map((type) => {
          const active = filters.type === type;
          return (
            <button
              key={type}
              onClick={() => setFilters({ ...filters, type })}
              className={
                "rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40")
              }
            >
              {type === "All" ? "הכל" : type}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;
