import { Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Operations from "@/pages/Operations";
import Targets from "@/pages/Targets";
import Vulnerabilities from "@/pages/Vulnerabilities";
import Agents from "@/pages/Agents";
import Infrastructure from "@/pages/Infrastructure";
import Tools from "@/pages/Tools";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Users from "@/pages/Users";
import Login from "@/pages/Login";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/operations" component={Operations} />
        <Route path="/targets" component={Targets} />
        <Route path="/vulnerabilities" component={Vulnerabilities} />
        <Route path="/agents" component={Agents} />
        <Route path="/infrastructure" component={Infrastructure} />
        <Route path="/tools" component={Tools} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route path="/users" component={Users} />
        <Route>
          <div className="p-8">
            <h1 className="text-3xl font-bold mb-4">404 - Page Not Found</h1>
            <p className="text-gray-600">The page you're looking for doesn't exist.</p>
          </div>
        </Route>
      </Switch>
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
