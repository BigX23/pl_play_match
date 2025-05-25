import React from 'react';

function OpenMatchesPage() {
  return (
    <div className="flex">
      {/* Sidebar will go here */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold">Open Matches</h1>
        {/* Content for open matches will go here */}
        <p>This is the open matches page.</p>
      </main>
    </div>
  );
}

export default OpenMatchesPage;