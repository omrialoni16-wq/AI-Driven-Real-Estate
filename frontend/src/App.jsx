import { useState, useEffect } from "react";
import { Plus, Home, Loader2, LogOut, ChevronDown, UserPlus } from "lucide-react";

import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PropertyCard from "./components/PropertyCard";
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
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Home className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                לוח נכסים
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalProperties.toLocaleString()} נכסים זמינים
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
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
              <Button variant="outline" onClick={() => setIsLoginOpen(true)}>
                התחברות
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <FilterBar filters={filters} setFilters={setFilters} />

        {isLoading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-lg font-medium">טוען נכסים…</p>
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
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
            <Home className="size-10 opacity-40" />
            <p className="text-lg font-medium">לא נמצאו נכסים התואמים את הסינון.</p>
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
