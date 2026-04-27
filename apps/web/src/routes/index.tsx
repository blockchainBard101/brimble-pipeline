import { createFileRoute } from '@tanstack/react-router';
import { Topbar } from '../components/Topbar';
import { DeployForm } from '../components/DeployForm';
import { DeploymentList } from '../components/DeploymentList';
import { useDeployments } from '../hooks/useDeployments';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const { stats } = useDeployments();

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <Topbar
        stats={stats}
        onNew={() => document.getElementById('deploy-name')?.focus()}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[340px] shrink-0 border-r border-zinc-800 overflow-y-auto p-5">
          <DeployForm />
        </aside>
        <main className="flex-1 overflow-y-auto px-5 pb-6">
          <DeploymentList />
        </main>
      </div>
    </div>
  );
}
