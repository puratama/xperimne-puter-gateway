"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { User, Shield, CheckCircle2, AlertCircle, Settings as SettingsIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";
import { Tabs } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "profile" | "security";

function Feedback({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        type === "success"
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

function ProfileTab({ onProvider }: { onProvider?: (p: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("email");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setName(data.user.name ?? "");
          setEmail(data.user.email ?? "");
          setProvider(data.user.provider ?? "email");
          onProvider?.(data.user.provider ?? "email");
        }
      })
      .finally(() => setLoading(false));
  }, [onProvider]);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setFeedback({ type: "success", message: "Profile updated successfully." });
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: getApiErrorMessage(data, "Failed to update profile.") });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input
          id="settings-email"
          type="email"
          value={email}
          disabled
          className="bg-muted text-muted-foreground cursor-not-allowed"
          placeholder="you@example.com"
        />
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>
      <div className="space-y-2">
        <Label>Login Provider</Label>
        <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted text-sm text-muted-foreground">
          {provider === "google" ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </>
          ) : (
            "Email"
          )}
        </div>
      </div>
      {feedback && <Feedback type={feedback.type} message={feedback.message} />}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Profile
      </Button>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSave() {
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", message: "New passwords do not match." });
      return;
    }
    if (!newPassword) {
      setFeedback({ type: "error", message: "New password cannot be empty." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setFeedback({ type: "success", message: "Password changed successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: getApiErrorMessage(data, "Failed to change password.") });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="settings-current-pw">Current Password</Label>
        <Input
          id="settings-current-pw"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-new-pw">New Password</Label>
        <Input
          id="settings-new-pw"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-confirm-pw">Confirm New Password</Label>
        <Input
          id="settings-confirm-pw"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="bg-background"
        />
      </div>
      {feedback && <Feedback type={feedback.type} message={feedback.message} />}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Change Password
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [provider, setProvider] = useState("email");

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "profile", label: "Profile", icon: User },
    ...(provider !== "google" ? [{ id: "security" as Tab, label: "Security", icon: Shield }] : []),
  ];

  // If user is Google and on security tab, switch back to profile
  useEffect(() => {
    if (provider === "google" && tab === "security") setTab("profile");
  }, [provider, tab]);

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <SettingsIcon className="h-4 w-4 text-primary" /> Settings
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
              <p className="text-sm text-muted-foreground">Manage your profile and security preferences.</p>
            </div>
          </header>

          <Tabs
            items={tabs.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            ariaLabel="Settings sections"
          />

          <Card>
            <CardContent className="p-6">
              <div className="max-w-md">
                {tab === "profile" && <ProfileTab onProvider={setProvider} />}
                {tab === "security" && <SecurityTab />}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
