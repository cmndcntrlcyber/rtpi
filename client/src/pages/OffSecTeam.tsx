import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Microscope, Bot, Wrench, FolderOpen, FlaskConical, BookOpen } from "lucide-react";
import RDAgentsTab from "@/components/offsec-team/RDAgentsTab";
import ToolLabTab from "@/components/offsec-team/ToolLabTab";
import ResearchProjectsTab from "@/components/offsec-team/ResearchProjectsTab";
import ExperimentsTab from "@/components/offsec-team/ExperimentsTab";
import KnowledgeBaseTab from "@/components/offsec-team/KnowledgeBaseTab";

export default function OffSecTeam() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Microscope className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">OffSec Team R&D Lab</h1>
          <p className="text-muted-foreground">
            Internal offensive security research and development
          </p>
        </div>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">R&D Agents</span>
            <span className="sm:hidden">Agents</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Tool Lab</span>
            <span className="sm:hidden">Tools</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Research Projects</span>
            <span className="sm:hidden">Projects</span>
          </TabsTrigger>
          <TabsTrigger value="experiments" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">Experiments</span>
            <span className="sm:hidden">Tests</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Knowledge Base</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-0">
          <RDAgentsTab />
        </TabsContent>

        <TabsContent value="tools" className="mt-0">
          <ToolLabTab />
        </TabsContent>

        <TabsContent value="projects" className="mt-0">
          <ResearchProjectsTab />
        </TabsContent>

        <TabsContent value="experiments" className="mt-0">
          <ExperimentsTab />
        </TabsContent>

        <TabsContent value="knowledge" className="mt-0">
          <KnowledgeBaseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
