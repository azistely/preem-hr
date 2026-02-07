import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton } from "@/components/skeletons";
import { CardListSkeleton } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <div className="container py-8 space-y-8">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats row */}
      <StatsGridSkeleton count={4} />

      {/* Content cards */}
      <CardListSkeleton count={4} />
    </div>
  );
}
