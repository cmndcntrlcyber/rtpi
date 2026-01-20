import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, AlertCircle, Database } from "lucide-react";

export default function KnowledgeBaseTab() {
  return (
    <div>
      {/* Info Alert */}
      <Alert className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          The Knowledge Base feature requires the <code className="bg-muted px-1 py-0.5 rounded">pgvector</code> PostgreSQL extension
          for vector similarity search and RAG capabilities. Please install the extension to enable this feature.
        </AlertDescription>
      </Alert>

      {/* Stats Cards (Placeholder) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              POCs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Techniques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <CardTitle>Knowledge Base</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Centralized repository for security research, techniques, and documentation
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Planned Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Full-text search across all articles and documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Vector similarity search powered by pgvector for semantic queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>MITRE ATT&CK framework mapping for techniques and tactics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Markdown editor for creating and editing articles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Related articles suggestions using embeddings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Integration with research projects and experiments</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-2">Article Categories</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  "Web Application Security",
                  "Network Security",
                  "Cloud Security",
                  "Active Directory",
                  "Malware Development",
                  "Reverse Engineering",
                  "Post-Exploitation",
                  "Detection Evasion",
                ].map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Installing pgvector</p>
                  <p>To enable the Knowledge Base feature, install the pgvector extension in your PostgreSQL database:</p>
                  <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto">
                    <code>CREATE EXTENSION IF NOT EXISTS vector;</code>
                  </pre>
                  <p className="mt-2">Then re-run the database migration to create the knowledge_base table.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
