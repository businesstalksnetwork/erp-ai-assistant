import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 50;

interface UsePaginatedQueryOptions<T> {
  queryKey: unknown[];
  queryFn: (range: { from: number; to: number }) => Promise<T[]>;
  enabled?: boolean;
}

export function usePaginatedQuery<T>({ queryKey, queryFn, enabled = true }: UsePaginatedQueryOptions<T>) {
  const [page, setPage] = useState(0);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data = [], isLoading } = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => queryFn({ from, to }),
    enabled,
  });

  const hasMore = data.length === PAGE_SIZE;

  return {
    data,
    page,
    setPage,
    hasMore,
    isLoading,
    pageSize: PAGE_SIZE,
  };
}
