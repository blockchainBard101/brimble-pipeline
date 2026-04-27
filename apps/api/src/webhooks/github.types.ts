export interface GitHubRepository {
  name: string;
  full_name: string;
  clone_url: string;
  default_branch: string;
}

export interface GitHubCommit {
  id: string;
  message: string;
  author: { name: string; email: string };
  url: string;
}

export interface GitHubPushPayload {
  ref: string;
  repository: GitHubRepository;
  pusher: { name: string; email: string };
  head_commit: GitHubCommit;
  commits: GitHubCommit[];
}
