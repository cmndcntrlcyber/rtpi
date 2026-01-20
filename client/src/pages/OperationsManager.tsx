import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, Bot, HelpCircle, Activity, Play, Power, PowerOff, Plus, AlertCircle } from "lucide-react";
import { useReporterAgents } from "../hooks/useReporterAgents";
import { useAssetQuestions } from "../hooks/useAssetQuestions";
import { useOperations } from "../hooks/useOperations";
import { useOperationsManagement } from "../hooks/useOperationsManagement";
import { ReporterAgentCard } from "../components/operations-manager/ReporterAgentCard";
import { AssetQuestionCard } from "../components/operations-manager/AssetQuestionCard";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export function OperationsManager() {
  const [, navigate] = useLocation();
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);

  const { operations, loading: operationsLoading, error: operationsError } = useOperations();
  const { agents, loading: agentsLoading, error: agentsError } = useReporterAgents();
  const {
    questions,
    loading: questionsLoading,
    answerQuestion,
  } = useAssetQuestions(selectedOperation || "", "pending");
  const {
    data: opsData,
    loading: opsLoading,
    enableHourlyReporting,
    disableHourlyReporting,
    triggerNow,
  } = useOperationsManagement(selectedOperation || "");

  const [triggering, setTriggering] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Auto-select the first operation when operations are loaded
  useEffect(() => {
    if (!selectedOperation && operations.length > 0) {
      setSelectedOperation(operations[0].id);
    }
  }, [operations, selectedOperation]);

  const handleTriggerNow = async () => {
    try {
      setTriggering(true);
      await triggerNow();
      alert("Workflow triggered successfully!");
    } catch (error) {
      console.error("Failed to trigger workflow:", error);
      alert("Failed to trigger workflow");
    } finally {
      setTriggering(false);
    }
  };

  const handleToggleReporting = async () => {
    if (!opsData?.operation) return;

    try {
      setToggling(true);
      if (opsData.operation.hourlyReportingEnabled) {
        await disableHourlyReporting();
      } else {
        await enableHourlyReporting();
      }
    } catch (error) {
      console.error("Failed to toggle hourly reporting:", error);
      alert("Failed to toggle hourly reporting");
    } finally {
      setToggling(false);
    }
  };

  // Show loading only while fetching operations list initially
  if (operationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error if operations failed to load
  if (operationsError) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 p-4 rounded-lg border border-destructive">
          <AlertCircle className="h-5 w-5 inline-block mr-2" />
          <p className="text-destructive inline">Error loading operations: {operationsError}</p>
        </div>
      </div>
    );
  }

  // Show empty state when no operations exist
  if (operations.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Activity className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Operations Found</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need to create an operation first before you can manage autonomous operations and hourly reporting.
          </p>
          <Button onClick={() => navigate("/operations")} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Operation
          </Button>
        </div>
      </div>
    );
  }

  // Show error if agents failed to load (after we know operations exist)
  if (agentsError) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 p-4 rounded-lg border border-destructive">
          <AlertCircle className="h-5 w-5 inline-block mr-2" />
          <p className="text-destructive inline">Error loading agents: {agentsError}</p>
        </div>
      </div>
    );
  }

  const stats = opsData?.stats || {
    activeReporters: 0,
    pendingQuestions: 0,
    recentTasksCount: 0,
  };

  const hourlyReportingEnabled = opsData?.operation?.hourlyReportingEnabled || false;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Operations Manager</h1>
          <p className="text-muted-foreground mt-1">
            Autonomous operations management and hourly reporting
          </p>
        </div>

        <div className="flex gap-3 items-center">
          {/* Operation Selector */}
          {operations.length > 1 && (
            <Select value={selectedOperation || ""} onValueChange={setSelectedOperation}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent>
                {operations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {operations.length === 1 && (
            <div className="px-4 py-2 bg-muted rounded-md text-sm font-medium">
              {operations[0].name}
            </div>
          )}
          <Button
            onClick={handleToggleReporting}
            disabled={toggling}
            variant={hourlyReportingEnabled ? "destructive" : "default"}
          >
            {hourlyReportingEnabled ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Disable Hourly Reporting
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Enable Hourly Reporting
              </>
            )}
          </Button>

          <Button onClick={handleTriggerNow} disabled={triggering} variant="outline">
            {triggering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Triggering...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Trigger Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg shadow border border-border">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="h-8 w-8 text-purple-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Active Reporters</h3>
          </div>
          <p className="text-3xl font-bold">{stats.activeReporters}</p>
          <p className="text-sm text-muted-foreground mt-2">Page reporter agents running</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow border border-border">
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="h-8 w-8 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Pending Questions</h3>
          </div>
          <p className="text-3xl font-bold">{stats.pendingQuestions}</p>
          <p className="text-sm text-muted-foreground mt-2">Asset questions awaiting answers</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow border border-border">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 text-green-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Recent Tasks</h3>
          </div>
          <p className="text-3xl font-bold">{stats.recentTasksCount}</p>
          <p className="text-sm text-muted-foreground mt-2">Manager coordination tasks</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reporters" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="reporters">Reporters ({agents.length})</TabsTrigger>
          <TabsTrigger value="questions">Questions ({stats.pendingQuestions})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="reporters" className="space-y-4 mt-6">
          {agents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reporter agents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <ReporterAgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={(agent) => {
                    console.log("Reporter clicked:", agent);
                    // TODO: Navigate to detailed report view
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="questions" className="space-y-4 mt-6">
          {questionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending questions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => (
                <AssetQuestionCard
                  key={question.id}
                  question={question}
                  onAnswer={answerQuestion}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 mt-6">
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Timeline view coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
