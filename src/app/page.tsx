import Link from 'next/link';
import React from 'react';
function LandingPage() {
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen py-2 bg-cover bg-center"
      style={{ backgroundImage: "url('/images/tennis-court.jpg')" }} // Placeholder image path
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-white"> {/* text-white applies to children by default, will override for h1 */}
        {/* Changed text color to green-600 */}
        <h1 className="text-4xl font-bold mb-6 text-green-600">Welcome to Pleasanton PlayMatch</h1>
        <p className="text-lg mb-8 text-center">Find Tennis and Pickleball partners in Pleasanton</p>
        <div className="space-x-4">
          <Link href="/login">
            {/* Login button with vibrant green */}
            <button className="px-6 py-2 border rounded-md text-green-400 border-green-400 hover:bg-green-500 hover:text-white transition-colors">Login</button>
          </Link>
          <Link href="/register">
            {/* Register button with bright orange */}
            <button className="px-6 py-2 border rounded-md text-white bg-orange-500 border-orange-500 hover:bg-orange-600 transition-colors">Register</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;