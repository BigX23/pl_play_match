"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getReports, setReportStatus, type AdminReport } from "@/lib/safety";

type Filter = "open" | "reviewed" | "actioned" | "all";
const FILTERS: Filter[] = ["open", "reviewed", "actioned", "all"];

/**
 * Minimal moderation queue. Admin-only — the API (ADMIN_EMAILS allow-list)
 * is the real gate; this page just renders a 403 as "Admins only".
 */
export default function AdminReportsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("open");
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  const load = useCallback(async (f: Filter) => {
    setState("loading");
    try {
      setReports(await getReports(f));
      setState("ready");
    } catch (err) {
      setState(String(err).includes("403") ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const update = async (r: AdminReport, status: AdminReport["status"]) => {
    try {
      await setReportStatus(r.id, status);
      toast({ title: `Report marked ${status}` });
      await load(filter);
    } catch {
      toast({ title: "Couldn't update report", variant: "destructive" });
    }
  };

  if (state === "forbidden") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Admins only.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Flag className="h-6 w-6" />Reports</h1>
        <p className="text-muted-foreground">User reports awaiting moderation. Aim to respond within 24 hours.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reports">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={f === filter ? "default" : "outline"}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {state === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
      {state === "error" && <p className="text-sm text-muted-foreground">Couldn&apos;t load reports.</p>}
      {state === "ready" && reports?.length === 0 && (
        <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : `${filter} `}reports.</p>
      )}

      {state === "ready" && reports?.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <span>{r.reported.name}</span>
              <Badge variant="secondary" className="capitalize">{r.reason.replace("_", " ")}</Badge>
              <Badge variant="outline">{r.context}</Badge>
              <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
            </CardTitle>
            <CardDescription>
              {new Date(r.createdAt).toLocaleString()} · reported by {r.reporter.name}
              {r.reported.email ? ` · ${r.reported.email}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.messageText && (
              <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground whitespace-pre-wrap">
                {r.messageText}
              </blockquote>
            )}
            {r.details && <p className="text-sm whitespace-pre-wrap">{r.details}</p>}
            <div className="flex flex-wrap gap-2">
              {r.status !== "reviewed" && (
                <Button size="sm" variant="outline" onClick={() => update(r, "reviewed")}>Mark reviewed</Button>
              )}
              {r.status !== "actioned" && (
                <Button size="sm" variant="outline" onClick={() => update(r, "actioned")}>Mark actioned</Button>
              )}
              {r.status !== "open" && (
                <Button size="sm" variant="ghost" onClick={() => update(r, "open")}>Reopen</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
