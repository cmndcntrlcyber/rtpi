import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelManager } from "@/components/ollama/ModelManager";
import { AIProviderSettings } from "@/components/ollama/AIProviderSettings";
import { PerformanceBenchmarks } from "@/components/ollama/PerformanceBenchmarks";
import { Cpu, Settings2, TrendingUp } from "lucide-react";

export default function Ollama() {
  const [activeTab, setActiveTab] = useState("models");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ollama AI</h1>
          <p className="text-muted-foreground mt-1">
            Manage local AI models and configure AI providers
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Models
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Benchmarks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Management</CardTitle>
              <CardDescription>
                Download, manage, and monitor your local Ollama models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
              <CardDescription>
                Configure AI providers and default model preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIProviderSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Benchmarks</CardTitle>
              <CardDescription>
                Compare performance across different models and providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceBenchmarks />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
