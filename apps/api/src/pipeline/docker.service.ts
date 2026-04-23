import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';

@Injectable()
export class DockerService {
  private readonly docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

  async runContainer(
    imageTag: string,
    deploymentId: string,
  ): Promise<{ containerId: string; port: number }> {
    const port = this.randomPort();

    const container = await this.docker.createContainer({
      Image: imageTag,
      name: `brimble-${deploymentId}`,
      Env: [`PORT=${port}`],
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig: {
        PortBindings: { [`${port}/tcp`]: [{ HostPort: String(port) }] },
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });

    await container.start();
    return { containerId: container.id, port };
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      await container.remove({ force: true });
    } catch {
      // container may already be gone
    }
  }

  private randomPort(): number {
    return Math.floor(Math.random() * 10_000) + 10_000;
  }
}
