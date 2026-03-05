import { useState, useEffect } from "react";
import { BookOpen, ExternalLink } from "lucide-react";

interface Subcategory {
  id: string;
  subcategoryId: string;
  name: string;
  description: string | null;
  implementationExamples: string[] | null;
  informativeReferences: string[] | null;
}

interface Category {
  id: string;
  categoryId: string;
  name: string;
  subcategories: Subcategory[];
}

interface NISTFunction {
  id: string;
  functionId: string;
  name: string;
  categories: Category[];
}

const functionColors: Record<string, string> = {
  GOVERN: "border-l-blue-600",
  MAP: "border-l-purple-600",
  MEASURE: "border-l-orange-500",
  MANAGE: "border-l-green-600",
};

export default function NISTImplementationGuide() {
  const [tree, setTree] = useState<NISTFunction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/nist-ai/all", { credentials: "include" })
      .then((r) => r.json())
      .then(setTree)
      .catch((e) => console.error("Failed to fetch NIST AI tree:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading implementation guide...</div>;

  if (tree.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No data imported yet. Click "Import NIST AI RMF" above.
      </div>
    );
  }

  // Flatten to subcategories that have implementation examples
  const guideSections = tree.flatMap((func) =>
    func.categories.flatMap((cat) =>
      cat.subcategories
        .filter((sub) => (sub.implementationExamples && sub.implementationExamples.length > 0) || (sub.informativeReferences && sub.informativeReferences.length > 0))
        .map((sub) => ({
          ...sub,
          funcId: func.functionId,
          funcName: func.name,
          catId: cat.categoryId,
          catName: cat.name,
        }))
    )
  );

  if (guideSections.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No implementation examples available. Framework data may not include examples.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Implementation Guide</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Actionable implementation examples and informative references for each NIST AI RMF subcategory.
        </p>
      </div>

      {guideSections.map((section) => (
        <div
          key={section.id}
          className={`bg-card rounded-lg border border-border border-l-4 ${functionColors[section.funcId] || ""} overflow-hidden`}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{section.subcategoryId}</span>
              <span className="text-sm font-semibold">{section.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              {section.funcName} &rarr; {section.catName}
            </p>
            {section.description && (
              <p className="text-sm text-muted-foreground mb-3">{section.description}</p>
            )}

            {section.implementationExamples && section.implementationExamples.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold mb-2">Implementation Examples</h4>
                <ul className="space-y-1">
                  {section.implementationExamples.map((ex, i) => (
                    <li key={i} className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {section.informativeReferences && section.informativeReferences.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> References
                </h4>
                <ul className="space-y-1">
                  {section.informativeReferences.map((ref, i) => (
                    <li key={i} className="text-xs text-muted-foreground">{ref}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
