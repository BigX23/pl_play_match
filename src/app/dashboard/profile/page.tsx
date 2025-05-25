import React from 'react';

function ProfilePage() {
  return (
    <div className="flex">
      {/* Sidebar will go here */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {/* Content for profile details will go here */}
        <p>This is the user profile page.</p>
      </main>
    </div>
  );
}

export default ProfilePage;