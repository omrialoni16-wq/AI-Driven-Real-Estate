import { useState, useEffect } from "react";
import { Plus, Home, LogOut, ChevronDown, UserPlus, Search } from "lucide-react";

import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PropertyCard from "./components/PropertyCard";
import PropertyCardSkeleton from "./components/PropertyCardSkeleton";
import AddPropertyForm from "./components/AddPropertyForm";
import FilterBar from "./components/FilterBar";
import Pagination from "./components/Pagination";
import AIChat from "./components/AIChat";
import EditPropertyForm from "./components/EditPropertyForm";
import LoginForm from "./components/LoginForm";
import AddAdminForm from "./components/AddAdminForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function App() {
  const { user, logout } = useAuth();
  const [properties, setProperties] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  const [filters, setFilters] = useState({
    city: "",
    maxPrice: "",
    type: "All",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const propertiesPerPage = 21;
  const [isLoading, setIsLoading] = useState(true);

  const fetchProperties = async (page = 1, filtersToUse = filters) => {
    setIsLoading(true);
    try {
      const queryParams = { page, limit: propertiesPerPage };

      if (filtersToUse.city?.trim()) {
        queryParams.city = filtersToUse.city;
      }
      if (filtersToUse.maxPrice) {
        queryParams.maxPrice = filtersToUse.maxPrice;
      }
      if (filtersToUse.type !== "All") {
        queryParams.type = filtersToUse.type;
      }

      const response = await api.get("/api/properties", {
        params: queryParams,
      });

      const {
        properties: propertiesData,
        totalPages: pages,
        totalProperties: total,
      } = response.data;

      setProperties(propertiesData || []);
      setTotalPages(pages || 1);
      setTotalProperties(total || 0);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to fetch properties", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    const delayDebounceFn = setTimeout(() => {
      fetchProperties(1, filters);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [filters]);

  const handleDelete = async (propertyId) => {
    const isConfirmed = window.confirm("האם אתה בטוח שברצונך למחוק נכס זה?");
    if (isConfirmed) {
      try {
        await api.delete(`/api/properties/${propertyId}`);
        fetchProperties(currentPage, filters);
      } catch (error) {
        console.error("Error deleting property:", error);
        alert("לא ניתן היה למחוק את הנכס. נסה שוב.");
      }
    }
  };

  const handleAddProperty = async (newPropertyData) => {
    try {
      await api.post("/api/properties", newPropertyData);
      fetchProperties(1, filters);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed adding property:", error);
      alert("לא ניתן היה להוסיף את הנכס. בדוק את קונסולת השרת.");
    }
  };

  const handleEditProperty = async (id, updatedData) => {
    try {
      await api.put(`/api/properties/${id}`, updatedData);
      fetchProperties(currentPage, filters);
      setEditingProperty(null);
    } catch (error) {
      console.error("Error updating property in React:", error);
    }
  };

  const handlePaginationChange = (newPage) => {
    setCurrentPage(newPage);
    fetchProperties(newPage, filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Home className="size-[22px]" strokeWidth={1.7} />
            </div>
            <div className="leading-tight">
              <h1 className="text-xl font-extrabold tracking-tight sm:text-[22px]">
                לוח נכסים
              </h1>
              <p className="mt-0.5 text-[12.5px] font-medium text-muted-foreground">
                נדל״ן נבחר · עדכני להיום
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
                    {user.name}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setIsAddAdminOpen(true)}>
                    <UserPlus />
                    הוספת מנהל
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={logout}>
                    <LogOut />
                    התנתקות
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsLoginOpen(true)}
                className="h-10 rounded-xl"
              >
                התחברות
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <section className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              נכסים למכירה
            </div>
            <h2 className="text-4xl font-extrabold leading-none tracking-tight">
              מצאו את הבית הבא שלכם
            </h2>
          </div>
          <div className="text-start">
            <div className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums">
              {totalProperties.toLocaleString()}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-muted-foreground">
              נכסים תואמים
            </div>
          </div>
        </section>

        <FilterBar filters={filters} setFilters={setFilters} />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : properties && properties.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((item) => (
              <PropertyCard
                key={item._id}
                property={item}
                isAdmin={!!user}
                onDelete={handleDelete}
                onEdit={(propertyToEdit) => setEditingProperty(propertyToEdit)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Search className="size-7" strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">
                לא נמצאו נכסים תואמים
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm font-medium text-muted-foreground">
                נסו לשנות את הסינון או להרחיב את טווח החיפוש כדי לראות עוד תוצאות.
              </p>
            </div>
          </div>
        )}

        <Pagination
          propertiesPerPage={propertiesPerPage}
          totalProperties={totalProperties}
          paginate={handlePaginationChange}
          currentPage={currentPage}
        />
      </div>

      {/* Add property dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת נכס חדש</DialogTitle>
            <DialogDescription>
              מלא את הפרטים כדי לפרסם מודעה חדשה.
            </DialogDescription>
          </DialogHeader>
          <AddPropertyForm onAdd={handleAddProperty} />
        </DialogContent>
      </Dialog>

      {/* Edit property dialog */}
      <Dialog
        open={!!editingProperty}
        onOpenChange={(open) => !open && setEditingProperty(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת פרטי הנכס</DialogTitle>
            <DialogDescription>
              עדכן את פרטי המודעה ושמור את השינויים.
            </DialogDescription>
          </DialogHeader>
          {editingProperty && (
            <EditPropertyForm
              property={editingProperty}
              onUpdate={handleEditProperty}
              onClose={() => setEditingProperty(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Login dialog */}
      <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>התחברות</DialogTitle>
            <DialogDescription>
              התחבר/י כדי לקבל הרשאות ניהול
            </DialogDescription>
          </DialogHeader>
          <LoginForm onSuccess={() => setIsLoginOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Add admin dialog */}
      <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת מנהל</DialogTitle>
            <DialogDescription>
              צור חשבון מנהל נוסף עם הרשאות זהות לשלך.
            </DialogDescription>
          </DialogHeader>
          <AddAdminForm onSuccess={() => setIsAddAdminOpen(false)} />
        </DialogContent>
      </Dialog>

      {user && (
        <>
          {/* Floating add button */}
          <Button
            size="icon"
            onClick={() => setIsModalOpen(true)}
            className="fixed bottom-8 right-8 z-40 size-14 rounded-full shadow-lg shadow-primary/30 transition-transform hover:scale-105 [&_svg:not([class*='size-'])]:size-6"
            aria-label="הוסף נכס"
          >
            <Plus />
          </Button>

          <AIChat onActionCompleted={() => fetchProperties(1, filters)} />
        </>
      )}
    </div>
  );
}

export default App;
