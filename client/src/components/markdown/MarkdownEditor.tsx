import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Edit } from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  rows = 10,
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<string>("edit");

  // Simple markdown to HTML converter (basic implementation)
  const renderMarkdown = (md: string): string => {
    let html = md;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/gim, '<pre class="bg-secondary p-3 rounded mt-2 mb-2 overflow-x-auto"><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/gim, '<code class="bg-secondary px-1 py-0.5 rounded text-sm">$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>');
    
    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');
    
    // Line breaks
    html = html.replace(/\n/gim, '<br />');
    
    return html;
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="edit" className="flex items-center gap-2">
          <Edit className="h-4 w-4" />
          Edit
        </TabsTrigger>
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Preview
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="edit" className="mt-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Supports Markdown: **bold**, *italic*, `code`, # headers, - lists, [links](url)
        </p>
      </TabsContent>
      
      <TabsContent value="preview" className="mt-2">
        <div className="border border-border rounded-md p-4 min-h-[200px] bg-card">
          {value ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
            />
          ) : (
            <p className="text-muted-foreground italic">No content to preview</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
