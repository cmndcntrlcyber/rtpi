import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BundleCard } from "./BundleCard";

interface Bundle {
  id: string;
  name: string;
  platform: "windows" | "linux";
  architecture: string;
  implantType: string;
  fileSize: number;
  createdAt: string;
  publicDownloadUrl?: string;
  tokenExpiresAt?: string;
  downloadUrl: string;
}

interface BundleGridProps {
  bundles: Bundle[];
  loading: boolean;
  onRefresh: () => void;
}

export function BundleGrid({ bundles, loading, onRefresh }: BundleGridProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Empty state
  if (bundles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No bundles generated yet</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Create your first agent bundle using the Deploy Windows Agent or Deploy
            Linux Agent buttons above.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Grid of bundle cards
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
