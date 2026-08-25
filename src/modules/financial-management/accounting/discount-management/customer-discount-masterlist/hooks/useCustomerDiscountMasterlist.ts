import { useState, useEffect } from "react";
import { MasterlistCustomerDiscount } from "../types";

export function useCustomerDiscountMasterlist(supplierId: number | null, search: string) {
  const [data, setData] = useState<MasterlistCustomerDiscount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!supplierId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([]);
      return;
    }

    const query = new URLSearchParams();
    query.set("supplierId", String(supplierId));
    if (search) query.set("search", search);

    const url = `/api/fm/accounting/discount-management/customer-discount-masterlist?${query.toString()}`;

    let isMounted = true;
    setIsLoading(true);
    setIsError(false);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json.data ?? []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsError(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [supplierId, search]);

  return { data, isLoading, isError };
}
