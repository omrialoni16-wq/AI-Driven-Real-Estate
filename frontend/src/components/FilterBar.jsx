import { useState } from "react";
import { Search, Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const [draft, setDraft] = useState(filters);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(draft);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-4 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            name="city"
            placeholder="חיפוש לפי עיר…"
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            className="h-12 rounded-xl bg-secondary/60 pe-11 text-[15px] font-medium"
          />
        </div>

        <div className="relative flex-1">
          <Banknote className="pointer-events-none absolute end-4 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            name="maxPrice"
            placeholder="מחיר מקסימלי…"
            value={draft.maxPrice}
            onChange={(e) =>
              setDraft({ ...draft, maxPrice: e.target.value })
            }
            className="h-12 rounded-xl bg-secondary/60 pe-11 text-[15px] font-medium"
          />
        </div>

        <Select
          value={draft.type}
          onValueChange={(value) => setDraft({ ...draft, type: value })}
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

        <Button
          type="submit"
          className="h-12 rounded-xl px-6 font-semibold"
        >
          <Search className="size-4" />
          חיפוש
        </Button>
      </div>
    </form>
  );
};

export default FilterBar;
