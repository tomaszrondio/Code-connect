import type { IPty } from 'node-pty';

export interface ClaudeSession {
  proc: IPty;
  busy: boolean;
  lastActivity: number;
  messageQueue: string[];
}
