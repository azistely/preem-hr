import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton } from "@/components/skeletons";
import { CardListSkeleton } from "@/components/skeletons";

export default function ManagerLoading() {
  return (
    <div className="container py-8 space-y-8">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stats row */}
      <StatsGridSkeleton count={3} />

      {/* Content cards */}
      <CardListSkeleton count={4} />
    </div>
  );
}
