import { Skeleton } from "@/components/ui/Skeleton";

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-dvh">
      <Skeleton className="h-14 shrink-0 rounded-none" />
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-24 w-2/3 max-w-md ml-auto" />
        <Skeleton className="h-32 w-3/4 max-w-lg" />
      </div>
      <Skeleton className="h-20 shrink-0 rounded-none" />
    </div>
  );
}
