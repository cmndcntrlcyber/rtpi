import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Subcategory {
  id: string;
  subcategoryId: string;
  categoryId: string;
  name: string;
  description: string | null;
  implementationExamples: string[] | null;
  informativeReferences: string[] | null;
}

interface Category {
  id: string;
  categoryId: string;
  functionId: string;
  name: string;
  description: string | null;
  subcategories: Subcategory[];
}

interface NISTFunction {
  id: string;
  functionId: string;
  name: string;
  description: string | null;
  categories: Category[];
}

const functionColors: Record<string, string> = {
  GOVERN: "text-blue-600 border-blue-600",
  MAP: "text-purple-600 border-purple-600",
  MEASURE: "text-orange-600 border-orange-600",
  MANAGE: "text-green-600 border-green-600",
};

export default function NISTFunctionsAccordion() {
  const [tree, setTree] = useState<NISTFunction[]>([]);
  const [expandedFuncs, setExpandedFuncs] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/nist-ai/all", { credentials: "include" })
      .then((r) => r.json())
      .then(setTree)
      .catch((e) => console.error("Failed to fetch NIST AI tree:", e))
      .finally(() => setLoading(false));
  }, []);

  const toggleFunc = (id: string) => {
    setExpandedFuncs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading functions...</div>;

  if (tree.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No functions imported yet. Click "Import NIST AI RMF" above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tree.map((func) => {
        const colorClass = functionColors[func.functionId] || "text-muted-foreground border-muted-foreground";
        return (
          <div key={func.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => toggleFunc(func.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {expandedFuncs.has(func.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`font-mono text-sm font-bold ${colorClass.split(" ")[0]}`}>
                  {func.functionId}
                </span>
                <span className="font-semibold">{func.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {func.categories.length} categories
              </span>
            </button>

            {expandedFuncs.has(func.id) && (
              <div className="border-t border-border">
                {func.description && (
                  <p className="px-4 pt-3 text-sm text-muted-foreground">{func.description}</p>
                )}
                <div className="p-4 space-y-2">
                  {func.categories.map((cat) => (
                    <div key={cat.id} className="border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCat(cat.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {expandedCats.has(cat.id) ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="font-mono text-xs text-muted-foreground">{cat.categoryId}</span>
                          <span className="text-sm font-medium">{cat.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {cat.subcategories.length} subcategories
                        </span>
                      </button>

                      {expandedCats.has(cat.id) && (
                        <div className="border-t border-border p-3 space-y-3">
                          {cat.description && (
                            <p className="text-sm text-muted-foreground">{cat.description}</p>
                          )}
                          {cat.subcategories.map((sub) => (
                            <div key={sub.id} className="bg-muted/30 rounded p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-muted-foreground">{sub.subcategoryId}</span>
                                <span className="text-sm font-medium">{sub.name}</span>
                              </div>
                              {sub.description && (
                                <p className="text-xs text-muted-foreground mb-2">{sub.description}</p>
                              )}
                              {sub.implementationExamples && sub.implementationExamples.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold mb-1">Implementation Examples</p>
                                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                                    {sub.implementationExamples.map((ex, i) => (
                                      <li key={i}>{ex}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
