import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const Pagination = ({
  propertiesPerPage,
  totalProperties,
  paginate,
  currentPage,
}) => {
  const totalPages = Math.ceil(totalProperties / propertiesPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 3;
    const siblingsCount = 1;

    for (let i = 1; i <= Math.min(maxPagesToShow, totalPages); i++) {
      pages.push(i);
    }

    const leftSibling = Math.max(
      currentPage - siblingsCount,
      maxPagesToShow + 1,
    );
    const rightSibling = Math.min(
      currentPage + siblingsCount,
      totalPages - maxPagesToShow,
    );

    if (leftSibling > maxPagesToShow + 1) {
      pages.push("...");
    }

    for (let i = leftSibling; i <= rightSibling; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (rightSibling < totalPages - maxPagesToShow) {
      pages.push("...");
    }

    for (
      let i = Math.max(totalPages - maxPagesToShow + 1, maxPagesToShow + 1);
      i <= totalPages;
      i++
    ) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePrevious = () => {
    if (currentPage > 1) {
      paginate(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      paginate(currentPage + 1);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="h-10 rounded-xl px-4"
      >
        <ChevronRight />
        הקודם
      </Button>

      {pageNumbers.map((number, index) =>
        number === "..." ? (
          <span
            key={`ellipsis-${index}`}
            className="px-2 text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={number}
            variant={currentPage === number ? "default" : "outline"}
            size="icon"
            className="size-10 rounded-xl font-bold tabular-nums"
            onClick={() => paginate(number)}
          >
            {number}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="h-10 rounded-xl px-4"
      >
        הבא
        <ChevronLeft />
      </Button>
    </nav>
  );
};

export default Pagination;
