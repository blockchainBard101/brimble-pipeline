import { createFileRoute } from '@tanstack/react-router';
import { DeployForm } from '../components/DeployForm';
import { DeploymentList } from '../components/DeploymentList';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="space-y-8">
      <DeployForm />
      <DeploymentList />
    </div>
  );
}
