import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Shield, Key, Calendar, Clock } from "lucide-react";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      await api.put(`/users/${user?.id}`, { email });
      setSuccess("Profile updated successfully");
      setEditMode(false);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      setLoading(false);
      return;
    }

    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      setSuccess("Password changed successfully");
      setPasswordMode(false);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-700";
      case "operator":
        return "bg-blue-100 text-blue-700";
      case "viewer":
        return "bg-secondary text-foreground";
      default:
        return "bg-secondary text-foreground";
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <User className="h-8 w-8" />
        <h1 className="text-3xl font-bold">User Profile</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details and role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!editMode ? (
              <>
                <div>
                  <Label className="text-sm text-muted-foreground">Username</Label>
                  <p className="text-lg font-medium">{user?.username}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="text-lg font-medium">{user?.email}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Role</Label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium capitalize ${getRoleBadgeColor(user?.role || "")}`}>
                      <Shield className="h-4 w-4" />
                      {user?.role}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Authentication Method</Label>
                  <p className="text-lg font-medium capitalize">{user?.authMethod}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Account Status</Label>
                  <p className="text-lg font-medium">
                    {user?.isActive ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-red-600">Inactive</span>
                    )}
                  </p>
                </div>
                {user?.authMethod === "local" && (
                  <Button onClick={() => setEditMode(true)} variant="outline">
                    Edit Profile
                  </Button>
                )}
              </>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user?.email}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Password and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!passwordMode ? (
              <>
                <div>
                  <Label className="text-sm text-muted-foreground">Password</Label>
                  <p className="text-lg font-medium">••••••••••••</p>
                </div>
                {user?.mustChangePassword && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                    You must change your password
                  </div>
                )}
                {user?.authMethod === "local" && (
                  <Button onClick={() => setPasswordMode(true)} variant="outline">
                    Change Password
                  </Button>
                )}
              </>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={12}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 12 characters with uppercase, lowercase, number, and special character
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Changing..." : "Change Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPasswordMode(false);
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Session Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Session Information
            </CardTitle>
            <CardDescription>Current session details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Last Login</Label>
              <p className="text-lg font-medium">
                {user?.lastLogin
                  ? new Date(user.lastLogin).toLocaleString()
                  : "This session"}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Account Created</Label>
              <p className="text-lg font-medium">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleString()
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Activity History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity History
            </CardTitle>
            <CardDescription>Recent account activity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity tracking coming soon. This will show login history, actions performed, and security events.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
