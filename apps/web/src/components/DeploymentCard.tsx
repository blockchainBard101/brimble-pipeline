import { useState } from 'react';
import { type Deployment } from '../lib/api';
import { LogStream } from './LogStream';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  building: 'bg-blue-500/20 text-blue-300',
  deploying: 'bg-purple-500/20 text-purple-300',
  running: 'bg-green-500/20 text-green-300',
  failed: 'bg-red-500/20 text-red-300',
};

interface Props {
  deployment: Deployment;
}

export function DeploymentCard({ deployment }: Props) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium truncate">{deployment.name}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[deployment.status] ?? 'bg-gray-700 text-gray-300'}`}
          >
            {deployment.status}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {deployment.url && (
            <a
              href={deployment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Open ↗
            </a>
          )}
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="rounded-md bg-gray-800 hover:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors"
          >
            {showLogs ? 'Hide Logs' : 'View Logs'}
          </button>
        </div>
      </div>

      {deployment.imageTag && (
        <p className="font-mono text-xs text-gray-500">{deployment.imageTag}</p>
      )}

      <p className="text-xs text-gray-600">
        {new Date(deployment.createdAt).toLocaleString()}
      </p>

      {showLogs && <LogStream deploymentId={deployment.id} />}
    </div>
  );
}
