import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-surface-2", className)} aria-hidden />;
}

export function ChatSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Cargando conversación">
      <div className="flex justify-end">
        <Skeleton className="h-14 w-[min(85%,20rem)] rounded-2xl rounded-br-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4 max-w-lg" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-5/6 max-w-md" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-[min(70%,16rem)] rounded-2xl rounded-br-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
    </div>
  );
}
