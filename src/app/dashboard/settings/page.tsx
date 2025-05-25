import React from 'react';

function SettingsPage() {
  return (
    <div className="flex">
      {/* Sidebar will go here */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold">My Partner Settings</h1>
        {/* Content for partner settings will go here */}
        <p>This is the partner settings page.</p>
      </main>
    </div>
  );
}

export default SettingsPage;