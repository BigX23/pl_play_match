"use client";

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from "@/components/ui/button";

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold text-primary">
          Pleasanton PlayMatch
        </h1>

        <p className="mt-3 text-2xl">
          Find your perfect Tennis or Pickleball partner in Pleasanton!
        </p>

        <div className="mt-6">
          <Button onClick={() => router.push('/register')}>
            Register Now
          </Button>
        </div>
      </main>
    </div>
  );
}
