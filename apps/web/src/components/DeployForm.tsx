import { useRef, useState } from 'react';
import { useCreateDeployment } from '../hooks/useCreateDeployment';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GitBranch, Upload } from 'lucide-react';

export function DeployForm() {
  const [mode, setMode] = useState<'git' | 'upload'>('git');
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useCreateDeployment();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    if (mode === 'git' && gitUrl) {
      mutate({ name, source: gitUrl, sourceType: 'git' });
      setName('');
      setGitUrl('');
    } else if (mode === 'upload' && file) {
      mutate({ name, source: file.name, sourceType: 'upload' });
      setName('');
      setFile(null);
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
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
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
