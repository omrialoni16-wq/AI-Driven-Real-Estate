const PropertyCardSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-52 w-full animate-pulse bg-muted" />
      <div className="flex flex-col gap-4 p-5">
        <div className="h-4 w-3/5 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-2/5 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
};

export default PropertyCardSkeleton;
