"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Moon, Sun, Bell, Shield, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState({ matches: true, messages: true, reminders: false });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sun className="h-5 w-5" />Appearance</CardTitle>
          <CardDescription>Customize how PlayMatch looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</CardTitle>
          <CardDescription>Choose what you get notified about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: "matches" as const, label: "New Match Suggestions", desc: "Get notified when compatible players are found" },
            { key: "messages" as const, label: "Messages", desc: "Notifications for new messages from partners" },
            { key: "reminders" as const, label: "Match Reminders", desc: "Reminders before upcoming matches" },
          ]).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={notifications[item.key]} onCheckedChange={(v) => setNotifications((n) => ({ ...n, [item.key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Account</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full">Change Password</Button>
          <Button variant="outline" className="w-full">Export My Data</Button>
          <Separator />
          <Button variant="destructive" className="w-full" onClick={() => { logout(); router.push("/"); }}>
            <LogOut className="h-4 w-4 mr-2" />Sign Out
          </Button>
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
