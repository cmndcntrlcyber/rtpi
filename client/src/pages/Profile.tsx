export default function Profile() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">User Profile</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Username</p>
              <p className="text-lg font-medium">Not logged in</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="text-lg font-medium">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Security</h2>
          <p className="text-gray-500">Password and security settings</p>
          <p className="text-sm text-gray-400 mt-2">Full functionality coming in M7</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Preferences</h2>
          <p className="text-gray-500">User preferences and notifications</p>
          <p className="text-sm text-gray-400 mt-2">Full functionality coming in M7</p>
        </div>
      </div>
    </div>
  );
}
