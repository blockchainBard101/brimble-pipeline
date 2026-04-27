import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Pencil } from 'lucide-react';
import { api, type EnvVarInput } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditRow {
  key: string;
  value: string;
}

export function EnvVarsPanel({ deploymentId }: { deploymentId: string }) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const queryClient = useQueryClient();

  const { data: envVars, isLoading } = useQuery({
    queryKey: ['env-vars', deploymentId],
    queryFn: () => api.envVars.list(deploymentId),
  });

  const update = useMutation({
    mutationFn: (vars: EnvVarInput[]) => api.envVars.update(deploymentId, vars),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['env-vars', deploymentId] });
      void queryClient.invalidateQueries({ queryKey: ['deployments'] });
      setEditing(false);
    },
  });

  function startEdit() {
    setRows(
      envVars?.map((v) => ({ key: v.key, value: '' })) ?? [],
    );
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setRows([]);
  }

  function addRow() {
    setRows((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: 'key' | 'value', val: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: val } : r)));
  }

  function save() {
    const valid = rows.filter((r) => r.key.trim());
    update.mutate(valid.map((r) => ({ key: r.key.trim(), value: r.value })));
  }

  if (isLoading) {
    return <p className="text-xs text-zinc-600 font-mono">Loading…</p>;
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={row.key}
                onChange={(e) => updateRow(i, 'key', e.target.value)}
                placeholder="KEY"
                className="h-7 flex-1 font-mono text-xs bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
              <Input
                value={row.value}
                onChange={(e) => updateRow(i, 'value', e.target.value)}
                placeholder="value"
                type="text"
                className="h-7 flex-1 font-mono text-xs bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
              <button
                onClick={() => removeRow(i)}
                className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
          >
            <Plus className="size-3" />
            Add variable
          </button>
          <div className="flex-1" />
          <button
            onClick={cancelEdit}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={save}
            disabled={update.isPending}
            size="sm"
            className="h-6 text-xs border-0 bg-emerald-700 hover:bg-emerald-600 text-white"
          >
            <Save className="size-3" />
            {update.isPending ? 'Saving…' : 'Save & redeploy'}
          </Button>
        </div>
        {update.isError && (
          <p className="text-xs text-red-400 font-mono">
            Failed to update env vars.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!envVars?.length ? (
        <p className="text-xs text-zinc-600 font-mono">No environment variables set.</p>
      ) : (
        <table className="w-full text-xs font-mono">
          <tbody>
            {envVars.map((v) => (
              <tr key={v.key} className="border-b border-zinc-800/50 last:border-0">
                <td className="py-1 pr-3 text-zinc-300 w-1/2">{v.key}</td>
                <td className="py-1 text-zinc-600">{v.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        onClick={startEdit}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
      >
        <Pencil className="size-3" />
        {envVars?.length ? 'Edit variables' : 'Add variables'}
      </button>
    </div>
  );
}
