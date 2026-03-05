import { useState, useEffect } from "react";

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
  categories: Category[];
}

const functionBadgeColor: Record<string, string> = {
  GOVERN: "bg-blue-600 text-white",
  MAP: "bg-purple-600 text-white",
  MEASURE: "bg-orange-500 text-white",
  MANAGE: "bg-green-600 text-white",
};

export default function NISTCategoriesTable() {
  const [tree, setTree] = useState<NISTFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSub, setExpandedSub] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/v1/nist-ai/all", { credentials: "include" })
      .then((r) => r.json())
      .then(setTree)
      .catch((e) => console.error("Failed to fetch NIST AI tree:", e))
      .finally(() => setLoading(false));
  }, []);

  const toggleSub = (id: string) => {
    setExpandedSub((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading categories...</div>;

  const allCategories = tree.flatMap((f) =>
    f.categories.map((c) => ({ ...c, functionName: f.name, funcId: f.functionId }))
  );

  if (allCategories.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No categories imported yet. Click "Import NIST AI RMF" above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allCategories.map((cat) => (
        <div key={cat.id} className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${functionBadgeColor[cat.funcId] || "bg-gray-500 text-white"}`}>
                  {cat.funcId}
                </span>
                <span className="font-mono text-sm text-muted-foreground">{cat.categoryId}</span>
                <span className="font-semibold">{cat.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{cat.subcategories.length} subcategories</span>
            </div>
            {cat.description && (
              <p className="text-sm text-muted-foreground mb-3">{cat.description}</p>
            )}
            {cat.subcategories.length > 0 && (
              <div className="space-y-2">
                {cat.subcategories.map((sub) => (
                  <div key={sub.id} className="border border-border rounded">
                    <button
                      onClick={() => toggleSub(sub.id)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors text-left text-sm"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{sub.subcategoryId}</span>
                      <span>{sub.name}</span>
                    </button>
                    {expandedSub.has(sub.id) && (
                      <div className="border-t border-border p-3 space-y-2">
                        {sub.description && (
                          <p className="text-xs text-muted-foreground">{sub.description}</p>
                        )}
                        {sub.implementationExamples && sub.implementationExamples.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-1">Implementation Examples</p>
                            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                              {sub.implementationExamples.map((ex, i) => (
                                <li key={i}>{ex}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {sub.informativeReferences && sub.informativeReferences.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-1">Informative References</p>
                            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                              {sub.informativeReferences.map((ref, i) => (
                                <li key={i}>{ref}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
