import { Skeleton } from "@/components/ui/skeleton";

export function ChatMessageSkeleton() {
  return (
    <div className="p-4 rounded-lg mb-4 bg-secondary/50">
      <div className="flex gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        </div>
      </div>
    </div>
  );
}
