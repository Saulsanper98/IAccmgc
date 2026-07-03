import { Skeleton } from "@/components/ui/Skeleton";

export default function SaludLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
