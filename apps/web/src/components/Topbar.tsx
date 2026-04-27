import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Stats {
  running: number;
  building: number;
  failed: number;
}

interface Props {
  stats: Stats;
  onNew: () => void;
}

export function Topbar({ stats, onNew }: Props) {
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-sm bg-emerald-500 shrink-0" />
        <span className="font-mono font-semibold text-sm text-zinc-100">brimble</span>
      </div>

      <div className="flex items-center gap-2">
        {stats.running > 0 && (
          <Badge
            variant="outline"
            className="border-zinc-700 text-emerald-500 font-mono text-[11px] gap-1"
          >
            <span>●</span>
            {stats.running} running
          </Badge>
        )}
        {stats.building > 0 && (
          <Badge
            variant="outline"
            className="border-zinc-700 text-amber-500 font-mono text-[11px] gap-1"
          >
            <span>●</span>
            {stats.building} building
          </Badge>
        )}
        {stats.failed > 0 && (
          <Badge
            variant="outline"
            className="border-zinc-700 text-red-500 font-mono text-[11px] gap-1"
          >
            <span>●</span>
            {stats.failed} failed
          </Badge>
        )}
      </div>

      <Button
        size="sm"
        onClick={onNew}
        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-0"
      >
        + New
      </Button>
    </header>
  );
}
