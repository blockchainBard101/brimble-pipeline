import { useRef, useState } from 'react';
import { useCreateDeployment } from '../hooks/useCreateDeployment';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GitBranch, Upload, Plus, X, Eye, EyeOff } from 'lucide-react';

interface EnvRow { key: string; value: string }

export function DeployForm() {
  const [mode, setMode] = useState<'git' | 'upload'>('git');
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [visibleRows, setVisibleRows] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useCreateDeployment();

  function addRow() {
    setEnvRows((r) => [...r, { key: '', value: '' }]);
  }

  function updateRow(i: number, field: 'key' | 'value', val: string) {
    setEnvRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  function handleKeyPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const isBlock = lines.length > 1 || (lines.length === 1 && lines[0].includes('='));
    if (!isBlock) return;
    e.preventDefault();
    const parsed = lines
      .filter((l) => !l.startsWith('#'))
      .map((l) => {
        const eq = l.indexOf('=');
        if (eq === -1) return null;
        return { key: l.slice(0, eq).trim(), value: l.slice(eq + 1).trim() };
      })
      .filter(Boolean) as EnvRow[];
    if (!parsed.length) return;
    setEnvRows((rows) => {
      const before = rows.slice(0, i).filter((r) => r.key);
      const after = rows.slice(i + 1).filter((r) => r.key);
      return [...before, ...parsed, ...after];
    });
    setVisibleRows(new Set());
  }

  function removeRow(i: number) {
    setEnvRows((r) => r.filter((_, idx) => idx !== i));
    setVisibleRows((s) => { const n = new Set(s); n.delete(i); return n; });
  }

  function toggleVisible(i: number) {
    setVisibleRows((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    const envVars = envRows.filter((r) => r.key.trim());
    if (mode === 'git' && gitUrl) {
      mutate({ name, source: gitUrl, sourceType: 'git', envVars });
      setName(''); setGitUrl(''); setEnvRows([]);
    } else if (mode === 'upload' && file) {
      mutate({ name, source: file.name, sourceType: 'upload', envVars });
      setName(''); setFile(null); setEnvRows([]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
        Deploy
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="deploy-name" className="text-xs text-zinc-500">
          Name
        </Label>
        <Input
          id="deploy-name"
          placeholder="my-app"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="h-8 text-sm bg-zinc-900 border-zinc-700 placeholder:text-zinc-600 focus-visible:border-zinc-500"
        />
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'git' | 'upload')}>
        <TabsList className="w-full bg-zinc-900 border border-zinc-800 h-8 p-0.5">
          <TabsTrigger value="git" className="flex-1 text-xs gap-1.5">
            <GitBranch className="size-3" />
            Git URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 text-xs gap-1.5">
            <Upload className="size-3" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="git" className="mt-2">
          <Input
            type="url"
            placeholder="https://github.com/org/repo"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            className="h-8 text-xs bg-zinc-900 border-zinc-700 placeholder:text-zinc-600 font-mono focus-visible:border-zinc-500"
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed h-24 cursor-pointer transition-colors ${
              dragging
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
          >
            <Upload className="size-4 text-zinc-500" />
            <p className="text-xs text-zinc-500">
              {file ? (
                <span className="text-zinc-300 font-mono">{file.name}</span>
              ) : (
                'Drop or click to upload'
              )}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </TabsContent>
      </Tabs>

      {/* Environment variables */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-500">Environment variables</Label>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
          >
            <Plus className="size-3" />
            Add
          </button>
        </div>

        {envRows.length === 0 && (
          <input
            placeholder="Paste KEY=value pairs here…"
            className="w-full h-7 rounded-md bg-zinc-900 border border-zinc-700 px-2 text-xs font-mono text-zinc-400 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            onPaste={(e) => handleKeyPaste(0, e)}
            readOnly
          />
        )}
        {envRows.length > 0 && (
          <div className="space-y-1.5">
            {envRows.map((row, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  placeholder="KEY"
                  value={row.key}
                  onChange={(e) => updateRow(i, 'key', e.target.value)}
                  onPaste={(e) => handleKeyPaste(i, e)}
                  className="h-7 text-xs bg-zinc-900 border-zinc-700 placeholder:text-zinc-600 font-mono focus-visible:border-zinc-500 w-2/5"
                />
                <div className="relative flex-1">
                  <Input
                    placeholder="value"
                    type={visibleRows.has(i) ? 'text' : 'password'}
                    value={row.value}
                    onChange={(e) => updateRow(i, 'value', e.target.value)}
                    className="h-7 text-xs bg-zinc-900 border-zinc-700 placeholder:text-zinc-600 font-mono focus-visible:border-zinc-500 pr-7 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisible(i)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {visibleRows.has(i) ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 p-1 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-0"
      >
        {isPending ? 'Queuing…' : 'Deploy'}
      </Button>
    </form>
  );
}
