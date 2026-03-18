"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PaymentTermsTable } from "./components/PaymentTermsTable";
import { AddPaymentTermDialog } from "./components/AddPaymentTermDialog";
import { EditPaymentTermDialog } from "./components/EditPaymentTermDialog"; // Import the Edit Dialog
import type { PaymentTerm } from "./types"; // Ensure you import your type

const PAGE_SIZE = 10;

function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const;
}

interface PaymentTermsModuleProps {
  currentUserId?: string;
}

export default function PaymentTermsModule({ currentUserId }: PaymentTermsModuleProps) {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  
  // 1. Add state to hold the term currently being edited
  const [termToEdit, setTermToEdit] = useState<PaymentTerm | null>(null);

  const fetchTerms = async () => {
    try {
      setIsLoading(true);
      // Ensure we always fetch fresh data and bypass any browser cache
      const res = await fetch("/api/fm/accounting/supplier-management/payment-terms", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTerms(data);
      }
    } catch (error) {
      console.error("Failed to fetch payment terms", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const tableTerms = useMemo<PaymentTerm[]>(() => {
    const sortedTerms = [...terms].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      if (leftTime !== rightTime) {
        return sortOrder === "newest" ? rightTime - leftTime : leftTime - rightTime;
      }

      const leftId = Number(left.id);
      const rightId = Number(right.id);
      if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
        return sortOrder === "newest" ? rightId - leftId : leftId - rightId;
      }

      return sortOrder === "newest"
        ? String(right.id).localeCompare(String(left.id))
        : String(left.id).localeCompare(String(right.id));
    });

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return sortedTerms;
    }

    const numericQuery = /^\d+$/.test(normalizedQuery);

    return sortedTerms.filter((term) => {
      const matchesName = term.name.toLowerCase().includes(normalizedQuery);
      const matchesNumber = numericQuery && String(term.id).trim().toLowerCase() === normalizedQuery;
      return matchesName || matchesNumber;
    });
  }, [searchQuery, sortOrder, terms]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(tableTerms.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTerms = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return tableTerms.slice(startIndex, startIndex + PAGE_SIZE);
  }, [safeCurrentPage, tableTerms]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startItem = tableTerms.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const endItem = tableTerms.length === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, tableTerms.length);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 pb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <WalletCards className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Payment Terms</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage payment terms{terms.length ? ` — ${terms.length} total` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <AddPaymentTermDialog onSuccess={fetchTerms} currentUserId={currentUserId} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-sm">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by No. or name"
          />
        </div>

        <div className="sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              setSortOrder((currentOrder) =>
                currentOrder === "newest" ? "oldest" : "newest",
              )
            }
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOrder === "newest" ? "Newest First" : "Oldest First"}
          </Button>
        </div>
      </div>

      {/* 2. Pass the onEdit prop to the table to resolve the error */}
      <PaymentTermsTable 
        terms={paginatedTerms} 
        isLoading={isLoading} 
        searchQuery={searchQuery}
        onEdit={(term) => setTermToEdit(term)} 
      />

      {!isLoading && tableTerms.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {tableTerms.length} payment terms
          </p>

          {totalPages > 1 ? (
            <Pagination className="mx-0 w-auto justify-start sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage((page) => Math.max(1, page - 1));
                    }}
                    aria-disabled={safeCurrentPage === 1}
                    className={safeCurrentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>

                {pageNumbers.map((pageNumber, index) =>
                  pageNumber === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={safeCurrentPage === pageNumber}
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage((page) => Math.min(totalPages, page + 1));
                    }}
                    aria-disabled={safeCurrentPage === totalPages}
                    className={safeCurrentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      ) : null}

      {/* 3. Render the Edit Dialog when a term is selected */}
      {termToEdit && (
        <EditPaymentTermDialog
          term={termToEdit}
          open={!!termToEdit}
         onOpenChange={(open: boolean) => !open && setTermToEdit(null)}
          onSuccess={() => {
            fetchTerms();
            setTermToEdit(null);
          }}
        />
      )}
    </div>
  );
}