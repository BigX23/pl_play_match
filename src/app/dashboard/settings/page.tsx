"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Sun, Bell, Shield, LogOut, Bot, Smartphone, Check, AlertTriangle } from "lucide-react";
import { loadPreferences, savePreferences, type NotificationPreferences, enablePushNotifications, getPushPermission } from "@/lib/notifications";

export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences>(loadPreferences());
  const [pushStatus, setPushStatus] = useState<"idle" | "loading" | "enabled" | "denied" | "unsupported">("idle");

  useEffect(() => {
    setPrefs(loadPreferences());
    // Check current push permission status
    const perm = getPushPermission();
    if (perm === "unsupported") setPushStatus("unsupported");
    else if (perm === "granted") setPushStatus("enabled");
    else if (perm === "denied") setPushStatus("denied");
  }, []);

  const updatePref = (key: keyof NotificationPreferences, value: boolean | string) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    savePreferences(updated);
  };

  const handleEnablePush = async () => {
    if (!user) return;
    setPushStatus("loading");
    const token = await enablePushNotifications(user.id);
    if (token) {
      setPushStatus("enabled");
    } else {
      const perm = getPushPermission();
      setPushStatus(perm === "denied" ? "denied" : "idle");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

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

      {/* Push Notifications Card */}
      <Card className={pushStatus === "enabled" ? "border-green-500/50" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Push Notifications</CardTitle>
          <CardDescription>Get notified on your phone when you have new matches, messages, and more</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pushStatus === "unsupported" ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Not Supported</p>
                <p className="text-xs text-muted-foreground">Push notifications aren&apos;t supported in this browser. Try using Chrome or Safari on your phone.</p>
              </div>
            </div>
          ) : pushStatus === "enabled" ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Push Notifications Enabled!</p>
                <p className="text-xs text-muted-foreground">You&apos;ll receive notifications for new matches, messages, and match reminders.</p>
              </div>
            </div>
          ) : pushStatus === "denied" ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Notifications Blocked</p>
                <p className="text-xs text-muted-foreground">You previously blocked notifications. To enable them, update your browser settings for this site and try again.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Enable push notifications to stay in the loop — even when the app is closed!</p>
              <Button
                onClick={handleEnablePush}
                disabled={pushStatus === "loading"}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {pushStatus === "loading" ? (
                  <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" /> Enabling...</>
                ) : (
                  <><Bell className="h-4 w-4 mr-2" /> Enable Push Notifications</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notification Preferences</CardTitle>
          <CardDescription>Choose what you get notified about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: "messages" as const, label: "Messages", desc: "Notifications for new messages from partners" },
            { key: "matchInvites" as const, label: "Match Invitations", desc: "Get notified when someone invites you to play" },
            { key: "reminders" as const, label: "Match Reminders", desc: "Reminders before upcoming matches" },
            { key: "aiSuggestions" as const, label: "Rally Suggestions", desc: "Rally match introductions and tips", icon: Bot },
          ]).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-1">
                  {item.icon && <item.icon className="h-3.5 w-3.5 text-orange-500" />}
                  {item.label}
                </Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={prefs[item.key] as boolean} onCheckedChange={(v) => updatePref(item.key, v)} />
            </div>
          ))}
          <Separator />
          <div>
            <Label>Quiet Hours</Label>
            <p className="text-xs text-muted-foreground mb-2">No notifications during these hours</p>
            <div className="flex items-center gap-2">
              <Input type="time" value={prefs.quietHoursStart} onChange={(e) => updatePref("quietHoursStart", e.target.value)} className="w-32" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="time" value={prefs.quietHoursEnd} onChange={(e) => updatePref("quietHoursEnd", e.target.value)} className="w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Account</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full">Change Password</Button>
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
