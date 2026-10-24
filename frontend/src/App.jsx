import { useState, useEffect } from "react";
import { Plus, Home, LogOut, ChevronDown, UserPlus, Search, Inbox, Eye } from "lucide-react";
import { toast } from "sonner";

import api, { isDemoReadOnly } from "@/lib/api";
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
import InquiryForm from "./components/InquiryForm";
import InquiriesPanel from "./components/InquiriesPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
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
  const { user, loginDemo, logout } = useAuth();
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);
  const [properties, setProperties] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [inquiringProperty, setInquiringProperty] = useState(null);

  const [isInquiriesOpen, setIsInquiriesOpen] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState("all");
  const [inquiriesPage, setInquiriesPage] = useState(1);
  const [totalInquiries, setTotalInquiries] = useState(0);
  const [isInquiriesLoading, setIsInquiriesLoading] = useState(false);
  const inquiriesPerPage = 20;

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
    fetchProperties(1, filters);
  }, [filters]);

  const handleDelete = async (propertyId) => {
    const isConfirmed = window.confirm("האם אתה בטוח שברצונך למחוק נכס זה?");
    if (isConfirmed) {
      try {
        await api.delete(`/api/properties/${propertyId}`);
        fetchProperties(currentPage, filters);
      } catch (error) {
        if (isDemoReadOnly(error)) return;
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
      if (isDemoReadOnly(error)) return;
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

  const fetchInquiries = async (page = 1, status = inquiryStatusFilter) => {
    setIsInquiriesLoading(true);
    try {
      const params = { page, limit: inquiriesPerPage };
      if (status !== "all") {
        params.status = status;
      }
      const response = await api.get("/api/inquiries", { params });
      setInquiries(response.data.inquiries || []);
      setTotalInquiries(response.data.totalInquiries || 0);
      setInquiriesPage(page);
    } catch (error) {
      console.error("Failed to fetch inquiries", error);
    } finally {
      setIsInquiriesLoading(false);
    }
  };

  const openInquiries = () => {
    setIsInquiriesOpen(true);
    fetchInquiries(1, inquiryStatusFilter);
  };

  const handleInquiryStatusFilterChange = (status) => {
    setInquiryStatusFilter(status);
    fetchInquiries(1, status);
  };

  const handleInquiryStatusChange = async (id, status) => {
    try {
      await api.patch(`/api/inquiries/${id}`, { status });
      fetchInquiries(inquiriesPage, inquiryStatusFilter);
    } catch (error) {
      if (isDemoReadOnly(error)) return;
      console.error("Error updating inquiry status:", error);
      alert("לא ניתן היה לעדכן את סטטוס הפנייה. נסה שוב.");
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoggingIn(true);
    try {
      await loginDemo();
      setIsLoginOpen(false);
      toast.success("נכנסת כאדמין דמו", {
        description: "אפשר לראות את כל כלי הניהול. שינויים לא יישמרו.",
      });
    } catch (error) {
      console.error("Demo login failed:", error);
      toast.error("לא ניתן היה להיכנס לדמו. נסה/י שוב בעוד רגע.");
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  const handlePaginationChange = (newPage) => {
    setCurrentPage(newPage);
    fetchProperties(newPage, filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {user?.isDemo && (
        <div className="sticky top-0 z-30 border-b border-amber-300/60 bg-amber-100 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950 dark:text-amber-100">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
            <p className="flex items-center gap-2 font-medium">
              <Eye className="size-4 shrink-0" />
              מצב דמו · קריאה בלבד, שינויים לא נשמרים
            </p>
            <button
              onClick={logout}
              className="font-semibold underline underline-offset-4 hover:opacity-80"
            >
              יציאה מהדמו
            </button>
          </div>
        </div>
      )}
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
                    {`שלום, ${user.name}`}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={openInquiries}>
                    <Inbox />
                    פניות
                  </DropdownMenuItem>
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
              <>
                <Button
                  onClick={handleDemoLogin}
                  disabled={isDemoLoggingIn}
                  className="h-10 rounded-xl"
                >
                  <Eye />
                  <span className="hidden sm:inline">
                    {isDemoLoggingIn ? "נכנס…" : "כניסה כאדמין דמו"}
                  </span>
                  <span className="sm:hidden">
                    {isDemoLoggingIn ? "נכנס…" : "דמו"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsLoginOpen(true)}
                  className="h-10 rounded-xl"
                >
                  התחברות
                </Button>
              </>
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
                onInquire={(propertyToInquire) => setInquiringProperty(propertyToInquire)}
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

      {/* Guest inquiry dialog */}
      <Dialog
        open={!!inquiringProperty}
        onOpenChange={(open) => !open && setInquiringProperty(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פנייה לגבי הנכס</DialogTitle>
            <DialogDescription>
              {inquiringProperty &&
                `${inquiringProperty.street}, ${inquiringProperty.city}`}
            </DialogDescription>
          </DialogHeader>
          {inquiringProperty && (
            <InquiryForm
              property={inquiringProperty}
              onSuccess={() => setInquiringProperty(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Admin inquiries dialog */}
      <Dialog open={isInquiriesOpen} onOpenChange={setIsInquiriesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>פניות לקוחות</DialogTitle>
            <DialogDescription>
              פניות שהשאירו גולשים לגבי נכסים.
            </DialogDescription>
          </DialogHeader>
          <InquiriesPanel
            inquiries={inquiries}
            isLoading={isInquiriesLoading}
            statusFilter={inquiryStatusFilter}
            onStatusFilterChange={handleInquiryStatusFilterChange}
            onStatusChange={handleInquiryStatusChange}
            currentPage={inquiriesPage}
            totalInquiries={totalInquiries}
            inquiriesPerPage={inquiriesPerPage}
            onPageChange={(page) => fetchInquiries(page, inquiryStatusFilter)}
          />
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
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            או
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            onClick={handleDemoLogin}
            disabled={isDemoLoggingIn}
          >
            <Eye />
            {isDemoLoggingIn ? "נכנס…" : "צפייה בצד הניהול במצב דמו"}
          </Button>
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

          <AIChat
            // A new key per account, so leaving the demo resets the chat.
            key={user.email}
            isDemo={!!user.isDemo}
            onActionCompleted={() => fetchProperties(1, filters)}
          />
        </>
      )}

      <Toaster position="top-center" />
    </div>
  );
}

export default App;
