import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface FormSkeletonProps {
  /** Number of form field rows to render */
  fields?: number;
  /** Show a card header skeleton */
  showHeader?: boolean;
  /** Show action buttons at the bottom */
  showActions?: boolean;
  /** Number of columns per row (1 or 2) */
  columns?: 1 | 2;
}

/**
 * Standardized loading skeleton for form pages.
 * Renders a card with header, field placeholders, and action buttons.
 */
export function FormSkeleton({
  fields = 6,
  showHeader = true,
  showActions = true,
  columns = 1,
}: FormSkeletonProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
      )}
      <CardContent className="space-y-6">
        {Array.from({ length: fields }).map((_, i) =>
          columns === 2 && i % 2 === 0 ? (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton />
              {i + 1 < fields && <FieldSkeleton />}
            </div>
          ) : columns === 1 ? (
            <FieldSkeleton key={i} />
          ) : null
        )}
        {showActions && (
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-20" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
