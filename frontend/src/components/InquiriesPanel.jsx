import { Mail, Phone, Inbox } from "lucide-react";

import Pagination from "./Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INQUIRY_STATUS_LABELS = {
  new: "חדשה",
  in_progress: "בטיפול",
  closed: "סגורה",
};

const formatDate = (value) =>
  new Date(value).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });

const InquiriesPanel = ({
  inquiries,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onStatusChange,
  currentPage,
  totalInquiries,
  inquiriesPerPage,
  onPageChange,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הפניות</SelectItem>
          {Object.entries(INQUIRY_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">טוען…</p>
        ) : inquiries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Inbox className="size-7" strokeWidth={1.6} />
            <p className="text-sm font-medium">אין פניות להצגה</p>
          </div>
        ) : (
          inquiries.map((inquiry) => (
            <div
              key={inquiry._id}
              className="flex flex-col gap-2 rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">
                    {inquiry.property
                      ? `${inquiry.property.street}, ${inquiry.property.city}`
                      : "הנכס נמחק"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(inquiry.createdAt)}
                  </p>
                </div>
                <Select
                  value={inquiry.status}
                  onValueChange={(status) => onStatusChange(inquiry._id, status)}
                >
                  <SelectTrigger size="sm" className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INQUIRY_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold">{inquiry.name || "אורח"}</span>
                {inquiry.phone && (
                  <a
                    href={`tel:${inquiry.phone}`}
                    dir="ltr"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="size-3.5" />
                    {inquiry.phone}
                  </a>
                )}
                {inquiry.email && (
                  <a
                    href={`mailto:${inquiry.email}`}
                    dir="ltr"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="size-3.5" />
                    {inquiry.email}
                  </a>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm">{inquiry.message}</p>
            </div>
          ))
        )}
      </div>

      <Pagination
        propertiesPerPage={inquiriesPerPage}
        totalProperties={totalInquiries}
        paginate={onPageChange}
        currentPage={currentPage}
      />
    </div>
  );
};

export default InquiriesPanel;
