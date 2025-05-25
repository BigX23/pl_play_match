import React from 'react';

function HomePage() {
  return (
    <div className="flex">
      {/* Sidebar will go here */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold">My Matches</h1>
        {/* Content for displaying matches will go here */}
        <p>Displaying potential matches (above 70% rank).</p>
      </main>
    </div>
  );
}

export default HomePage;