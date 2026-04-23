import { useState } from 'react';
import { useCreateDeployment } from '../hooks/useCreateDeployment';

type SourceMode = 'git' | 'upload';

export function DeployForm() {
  const [mode, setMode] = useState<SourceMode>('git');
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const { mutate, isPending } = useCreateDeployment();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    if (mode === 'git' && gitUrl) {
      mutate({ name, source: gitUrl, sourceType: 'git' });
    } else if (mode === 'upload' && file) {
      mutate({ name, source: file.name, sourceType: 'upload' });
    }

    setName('');
    setGitUrl('');
    setFile(null);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold">New Deployment</h2>

      <div className="flex gap-2">
        {(['git', 'upload'] as SourceMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {m === 'git' ? 'Git URL' : 'Upload'}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Deployment name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {mode === 'git' ? (
        <input
          type="url"
          placeholder="https://github.com/org/repo"
          value={gitUrl}
          onChange={(e) => setGitUrl(e.target.value)}
          required
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-sm file:text-gray-100 cursor-pointer"
        />
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        {isPending ? 'Deploying…' : 'Deploy'}
      </button>
    </form>
  );
}
