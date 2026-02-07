import { Skeleton } from "@/components/ui/skeleton";
import { CardListSkeleton } from "@/components/skeletons";

export default function EmployeeLoading() {
  return (
    <div className="container py-8 space-y-8">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Content cards */}
      <CardListSkeleton count={5} />
    </div>
  );
}
