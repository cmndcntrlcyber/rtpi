import { useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";

/**
 * Hook to set up automatic notification triggers based on various events.
 * This demonstrates how to integrate notifications throughout the app.
 */
export function useNotificationTriggers() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Example: Listen for custom events and trigger notifications
    const handleWorkflowComplete = (event: CustomEvent) => {
      const { workflowName, operationName } = event.detail;
      addNotification(
        "success",
        "Workflow Completed",
        `${workflowName} completed successfully for ${operationName}`,
        {
          actionUrl: "/agents",
          actionLabel: "View Details",
          showToast: true,
        }
      );
    };

    const handleVulnerabilityFound = (event: CustomEvent) => {
      const { severity, title } = event.detail;
      addNotification(
        severity === "critical" || severity === "high" ? "error" : "warning",
        "Vulnerability Detected",
        `${severity.toUpperCase()}: ${title}`,
        {
          actionUrl: "/vulnerabilities",
          actionLabel: "View Vulnerabilities",
          showToast: true,
        }
      );
    };

    const handleScanComplete = (event: CustomEvent) => {
      const { targetName, portsFound } = event.detail;
      addNotification(
        "info",
        "Scan Complete",
        `Scan completed for ${targetName}. Found ${portsFound} open ports.`,
        {
          actionUrl: "/targets",
          actionLabel: "View Target",
          showToast: true,
        }
      );
    };

    const handleEmpireAgent = (event: CustomEvent) => {
      const { agentName, action } = event.detail;
      addNotification(
        action === "new" ? "success" : "info",
        action === "new" ? "New Empire Agent" : "Empire Agent Update",
        `Agent ${agentName} ${action === "new" ? "connected" : "updated"}`,
        {
          actionUrl: "/empire",
          actionLabel: "View Empire",
          showToast: true,
        }
      );
    };

    // Listen for custom events
    window.addEventListener("workflow:complete" as any, handleWorkflowComplete);
    window.addEventListener("vulnerability:found" as any, handleVulnerabilityFound);
    window.addEventListener("scan:complete" as any, handleScanComplete);
    window.addEventListener("empire:agent" as any, handleEmpireAgent);

    return () => {
      window.removeEventListener("workflow:complete" as any, handleWorkflowComplete);
      window.removeEventListener("vulnerability:found" as any, handleVulnerabilityFound);
      window.removeEventListener("scan:complete" as any, handleScanComplete);
      window.removeEventListener("empire:agent" as any, handleEmpireAgent);
    };
  }, [addNotification]);
}

/**
 * Helper function to trigger custom notification events from anywhere in the app.
 * Usage:
 *   triggerNotificationEvent("workflow:complete", { workflowName: "Recon", operationName: "Op1" });
 */
export function triggerNotificationEvent(eventName: string, detail: any) {
  const event = new CustomEvent(eventName, { detail });
  window.dispatchEvent(event);
}
