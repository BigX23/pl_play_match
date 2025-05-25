"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/db/sqlite-data'; // Assuming login function exists in sqlite-data
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSignIn = async (e) => {
        e.preventDefault();
        try {
            await login(email, password); // Use the new login function
            router.push('/'); // Redirect to home page after successful sign-in
        } catch (error: any) {
            setError(error.message);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            // Handle Google Sign-in with SQLite (requires a different approach, potentially linking accounts)
            router.push('/'); // Redirect to home page after successful Google sign-in
        } catch (error: any) {
            setError(error.message);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-background-light-gray py-12">
            <Card className="w-full max-w-md shadow-md rounded-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-primary">Login</CardTitle>
                    <CardDescription>Enter your credentials to access your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                type="email"
                                id="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                type="password"
                                id="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
                            Sign In
                        </Button>
                    </form>
                    <div className="text-center py-2">
                        <Button variant="outline" onClick={handleGoogleSignIn}>
                            Sign In with Google
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginPage;
