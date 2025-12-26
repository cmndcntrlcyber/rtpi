import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { KeyboardShortcutsProvider } from "@/contexts/KeyboardShortcutsContext";
import MainLayout from "@/components/layout/MainLayout";
import { KeyboardShortcutsDialog } from "@/components/shared/KeyboardShortcutsDialog";
import Dashboard from "@/pages/Dashboard";
import Operations from "@/pages/Operations";
import Targets from "@/pages/Targets";
import Vulnerabilities from "@/pages/Vulnerabilities";
import Agents from "@/pages/Agents";
import Infrastructure from "@/pages/Infrastructure";
import Tools from "@/pages/Tools";
import ToolRegistry from "@/pages/ToolRegistry";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Users from "@/pages/Users";
import SurfaceAssessment from "@/pages/SurfaceAssessment";
import AttackFramework from "@/pages/AttackFramework";
import Empire from "@/pages/Empire";
import Login from "@/pages/Login";

const queryClient = new QueryClient();

function AppContent() {
  const { user, loading } = useAuth();

  // Apply dark mode on app load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "true") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <KeyboardShortcutsProvider>
      <MainLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/operations" component={Operations} />
          <Route path="/targets" component={Targets} />
          <Route path="/vulnerabilities" component={Vulnerabilities} />
          <Route path="/surface-assessment" component={SurfaceAssessment} />
          <Route path="/attack" component={AttackFramework} />
          <Route path="/agents" component={Agents} />
          <Route path="/empire" component={Empire} />
          <Route path="/infrastructure" component={Infrastructure} />
          <Route path="/tools" component={Tools} />
          <Route path="/tool-registry" component={ToolRegistry} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={Profile} />
          <Route path="/users" component={Users} />
          <Route>
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-4">404 - Page Not Found</h1>
              <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
            </div>
          </Route>
        </Switch>
      </MainLayout>
      <KeyboardShortcutsDialog />
    </KeyboardShortcutsProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
