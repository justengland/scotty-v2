export interface Task {
  id: string;
  repo: string;
  title: string;
  description: string;
  priority: number;
  contextFiles: Array<{ path: string; content: string }>;
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  commitSha?: string;
  durationMs: number;
}

export interface AwayTeam {
  id: string;
  execute(task: Task, repoPath: string): Promise<ExecutionResult>;
}

export const DEFAULT_TASK_PRIORITY = 0;
