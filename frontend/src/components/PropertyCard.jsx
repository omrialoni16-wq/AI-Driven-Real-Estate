import { useState } from "react";
import { BedDouble, Layers, Maximize, Home, Pencil, Trash2, MapPin } from "lucide-react";
import PropertyMapDialog from "./PropertyMapDialog";

const PropertyCard = ({ property, isAdmin, onDelete, onEdit }) => {
  const [isMapOpen, setIsMapOpen] = useState(false);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1.5 hover:border-foreground/25 hover:shadow-[0_22px_42px_-24px_rgba(0,0,0,0.45)]">
      <div className="relative h-52 w-full shrink-0 overflow-hidden bg-muted">
        {property.img ? (
          <img
            src={property.img}
            alt={`${property.street}, ${property.city}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <Home className="size-8" strokeWidth={1.3} />
            <span className="font-mono text-[10.5px] tracking-wide">
              property photo
            </span>
          </div>
        )}
        {property.type && (
          <span className="absolute right-3.5 top-3.5 rounded-full bg-primary px-3 py-1 text-[11.5px] font-bold tracking-wide text-primary-foreground">
            {property.type}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-snug tracking-tight">
              {property.street}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">
              {property.city}
            </p>
          </div>
          <button
            onClick={() => setIsMapOpen(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            aria-label="הצג מיקום על המפה"
            title="הצג מיקום על המפה"
          >
            <MapPin className="size-4" strokeWidth={1.8} />
          </button>
        </div>

        <p className="mt-3.5 text-[27px] font-extrabold leading-none tracking-tight tabular-nums">
          ₪{property.price.toLocaleString()}
        </p>

        <div className="mt-auto flex items-stretch pt-4 text-muted-foreground">
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <BedDouble className="size-[18px]" strokeWidth={1.7} />
            <span className="text-[13px] font-semibold tabular-nums">
              {property.rooms} חד׳
            </span>
          </div>
          <div className="w-px self-stretch bg-border" />
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <Layers className="size-[18px]" strokeWidth={1.7} />
            <span className="text-[13px] font-semibold tabular-nums">
              קומה {property.floor}
            </span>
          </div>
          <div className="w-px self-stretch bg-border" />
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <Maximize className="size-[18px]" strokeWidth={1.7} />
            <span className="text-[13px] font-semibold tabular-nums">
              {property.size} מ״ר
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            <button
              onClick={() => onEdit(property)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[13.5px] font-semibold transition-colors hover:border-foreground/40"
            >
              <Pencil className="size-[15px]" />
              עריכה
            </button>
            <button
              onClick={() => onDelete(property._id)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Trash2 className="size-[15px]" />
              מחיקה
            </button>
          </div>
        )}
      </div>

      <PropertyMapDialog
        property={property}
        open={isMapOpen}
        onOpenChange={setIsMapOpen}
      />
    </article>
  );
};

export default PropertyCard;
