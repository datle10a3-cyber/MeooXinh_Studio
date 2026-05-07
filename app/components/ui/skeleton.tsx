import { cn } from "@/app/utils/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#F4C7C4]/20", className)}
      {...props}
    />
  );
}

export function ViewSkeleton() {
  return (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[150px] bg-[#EA7188]/20" />
        <Skeleton className="h-8 w-[250px]" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 w-full sm:w-32 rounded-xl" />
        <Skeleton className="h-11 w-full sm:w-32 rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}
