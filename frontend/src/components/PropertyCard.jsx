import { BedDouble, Building, Maximize, Pencil, Trash2 } from "lucide-react";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PropertyCard = ({ property, isAdmin, onDelete, onEdit }) => {
  return (
    <Card className="group h-full gap-0 overflow-hidden rounded-lg border-border p-0 pb-5 shadow-none transition-colors duration-200 hover:border-foreground/40">
      <div className="relative h-52 w-full shrink-0 overflow-hidden bg-muted">
        {property.img && (
          <img
            src={property.img}
            alt={`${property.street}, ${property.city}`}
            loading="lazy"
            className="size-full object-cover"
          />
        )}
        {property.type && (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 rounded-sm uppercase tracking-wide"
          >
            {property.type}
          </Badge>
        )}
      </div>

      <CardContent className="mt-5 flex flex-col gap-3">
        <div>
          <h2 className="truncate text-lg font-semibold leading-tight">
            {property.street}
          </h2>
          <p className="text-sm text-muted-foreground">{property.city}</p>
        </div>

        <p className="text-2xl font-bold text-primary">
          ₪{property.price.toLocaleString()}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BedDouble className="size-4" />
            {property.rooms} חדרים
          </span>
          <span className="flex items-center gap-1.5">
            <Building className="size-4" />
            קומה {property.floor}
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize className="size-4" />
            {property.size} מ״ר
          </span>
        </div>
      </CardContent>

      {isAdmin && (
        <CardFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onEdit(property)}
          >
            <Pencil />
            עריכה
          </Button>
          <Button
            className="flex-1"
            onClick={() => onDelete(property._id)}
          >
            <Trash2 />
            מחיקה
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default PropertyCard;
