import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ExternalLink, Copy, Check, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { type Deployment, api } from '../lib/api';
import { useBuilds } from '../hooks/useBuilds';
import { LogStream } from './LogStream';
import { MetricsPanel } from './MetricsPanel';
import { ActivityFeed } from './ActivityFeed';
import { EnvVarsPanel } from './EnvVarsPanel';
import { StatusBadge } from './StatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function durationColor(ms: number): string {
  if (ms < 60_000) return 'text-emerald-400';
  if (ms < 300_000) return 'text-amber-400';
  return 'text-red-400';
}

export function DeploymentCard({ deployment }: { deployment: Deployment }) {
  const [showLogs, setShowLogs] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: builds } = useBuilds(showRollback ? deployment.id : null);

  const { data: webhookConfig } = useQuery({
    queryKey: ['webhook-url'],
    queryFn: () => api.config.getWebhookUrl(),
    enabled: showWebhook,
    staleTime: Infinity,
  });

  const redeploy = useMutation({
    mutationFn: () => api.deployments.redeploy(deployment.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['deployments'] }),
  });

  const rollback = useMutation({
    mutationFn: (imageTag: string) => api.deployments.rollback(deployment.id, imageTag),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['deployments'] });
      setShowRollback(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deployments.delete(deployment.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['deployments'] }),
  });

  const latestBuild = deployment.builds?.[0] ?? null;
  const canRedeploy = ['running', 'failed', 'stopped'].includes(deployment.status);

  function copyUrl() {
    if (!deployment.url) return;
    void navigator.clipboard.writeText(deployment.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-b border-zinc-800 py-3.5 last:border-0 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center gap-2.5 min-w-0">
        <StatusBadge status={deployment.status} />
        <span className="font-mono text-sm text-zinc-100 font-medium truncate flex-1 min-w-0">
          {deployment.name}
        </span>
        <span className="text-[11px] text-zinc-600 font-mono shrink-0 tabular-nums">
          {timeAgo(deployment.createdAt)}
        </span>

        {/* Toggle pills */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
              showLogs ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            logs
          </button>
          {deployment.status === 'running' && (
            <button
              onClick={() => setShowMetrics((v) => !v)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
                showMetrics ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              metrics
            </button>
          )}
          <button
            onClick={() => setShowActivity((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
              showActivity ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            activity
          </button>
          <button
            onClick={() => setShowEnvVars((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
              showEnvVars ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            env
          </button>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'text-zinc-600 hover:text-zinc-200 shrink-0',
            )}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => redeploy.mutate()}
              disabled={!canRedeploy || redeploy.isPending}
            >
              <RefreshCw className="size-3.5" />
              {redeploy.isPending ? 'Queuing…' : 'Redeploy'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowRollback((v) => !v)}>
              <RotateCcw className="size-3.5" />
              Rollback…
            </DropdownMenuItem>
            {deployment.sourceType === 'git' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowWebhook((v) => !v)}>
                  Auto-deploy
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* URL row */}
      {deployment.url && (
        <div className="flex items-center gap-1.5 ml-0.5">
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 font-mono truncate transition-colors"
          >
            {deployment.url}
            <ExternalLink className="size-2.5 shrink-0" />
          </a>
          <button
            onClick={copyUrl}
            className="shrink-0 p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Copy URL"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </div>
      )}

      {/* Build timing */}
      {latestBuild?.durationMs != null && (
        <div className="flex items-center gap-2 font-mono text-[11px] ml-0.5">
          <span className={durationColor(latestBuild.durationMs)}>
            built in {fmtDuration(latestBuild.durationMs)}
          </span>
          {latestBuild.cacheHit ? (
            <span className="rounded-full px-1.5 py-0.5 bg-amber-500/15 text-amber-400">
              ⚡ cached
            </span>
          ) : (
            <span className="text-zinc-600">cold</span>
          )}
        </div>
      )}

      {/* Rollback panel */}
      {showRollback && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">— select build —</option>
            {(builds ?? []).map((b) => (
              <option key={b.id} value={b.imageTag}>
                {b.imageTag} · {new Date(b.createdAt).toLocaleString()}
              </option>
            ))}
          </select>
          <Button
            disabled={!selectedTag || rollback.isPending}
            onClick={() => selectedTag && rollback.mutate(selectedTag)}
            size="sm"
            className="h-7 bg-amber-600 hover:bg-amber-500 text-white text-xs border-0 shrink-0"
          >
            {rollback.isPending ? 'Rolling back…' : 'Roll back'}
          </Button>
        </div>
      )}

      {/* Metrics */}
      {showMetrics && deployment.status === 'running' && (
        <MetricsPanel deploymentId={deployment.id} />
      )}

      {/* Logs */}
      {showLogs && <LogStream deploymentId={deployment.id} />}

      {/* Activity */}
      {showActivity && (
        <ActivityFeed deploymentId={deployment.id} status={deployment.status} />
      )}

      {/* Env vars */}
      {showEnvVars && <EnvVarsPanel deploymentId={deployment.id} />}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
          <p className="text-xs text-red-400">
            Delete <span className="font-mono font-semibold">{deployment.name}</span>? This cannot be undone.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              size="xs"
              className="h-6 bg-red-600 hover:bg-red-500 text-white text-xs border-0"
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      {/* Auto-deploy webhook */}
      {showWebhook && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 space-y-2 text-xs">
          <p className="font-medium text-zinc-300">GitHub Webhook — Auto-deploy on push</p>
          <p className="text-zinc-500">Add this URL under Settings → Webhooks in your repo:</p>
          <code className="block rounded bg-zinc-950 px-2 py-1.5 text-blue-300 font-mono break-all text-[11px]">
            {webhookConfig?.webhookUrl ?? 'Loading…'}
          </code>
          <p className="text-zinc-600">
            Content type: <code className="text-zinc-400">application/json</code>
            {' · '}Set <code className="text-zinc-400">GITHUB_WEBHOOK_SECRET</code> in API env
            {' · '}Events: {webhookConfig?.events.join(', ') ?? 'push'}
          </p>
        </div>
      )}
    </div>
  );
}
