import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { CONFIG } from './config.js';
import type { ClaudeSession } from './types.js';

export class SessionManager extends EventEmitter {
  private sessions = new Map<number, ClaudeSession>();
  private idleTimers = new Map<number, NodeJS.Timeout>();
  private sessionTimers = new Map<number, NodeJS.Timeout>();

  isAlive(chatId: number): boolean {
    return this.sessions.has(chatId);
  }

  spawn(chatId: number): void {
    if (this.sessions.has(chatId)) return;

    const proc = pty.spawn('claude', ['--continue'], {
      name: 'xterm-256color',
      cols: CONFIG.ptyCols,
      rows: CONFIG.ptyRows,
      cwd: CONFIG.projectDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    const session: ClaudeSession = {
      proc,
      busy: false,
      lastActivity: Date.now(),
      messageQueue: [],
    };

    proc.onData((data: string) => {
      session.lastActivity = Date.now();
      session.busy = true;
      this.emit('data', chatId, data);
      this.resetIdleTimer(chatId);
    });

    proc.onExit(({ exitCode }) => {
      this.cleanup(chatId);
      this.emit('exit', chatId, exitCode);
    });

    this.sessions.set(chatId, session);
    this.resetSessionTimer(chatId);

    setTimeout(() => this.emit('ready', chatId), 3000);
  }

  write(chatId: number, text: string): void {
    const session = this.sessions.get(chatId);
    if (!session) return;

    if (session.busy) {
      session.messageQueue.push(text);
      return;
    }

    session.busy = true;
    session.proc.write(text + '\r');
    this.resetSessionTimer(chatId);
  }

  sendCommand(chatId: number, command: string): void {
    this.write(chatId, command);
  }

  close(chatId: number): void {
    const session = this.sessions.get(chatId);
    if (!session) return;

    try {
      session.proc.write('/exit\r');
      setTimeout(() => {
        try { session.proc.kill(); } catch {}
        this.cleanup(chatId);
      }, 3000);
    } catch {
      this.cleanup(chatId);
    }
  }

  markIdle(chatId: number): void {
    const session = this.sessions.get(chatId);
    if (!session) return;
    session.busy = false;

    if (session.messageQueue.length > 0) {
      const next = session.messageQueue.shift()!;
      this.write(chatId, next);
    }
  }

  private resetIdleTimer(chatId: number) {
    const existing = this.idleTimers.get(chatId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.emit('idle', chatId);
      this.markIdle(chatId);
    }, CONFIG.idleTimeoutMs);
    this.idleTimers.set(chatId, timer);
  }

  private resetSessionTimer(chatId: number) {
    const existing = this.sessionTimers.get(chatId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.emit('timeout', chatId);
      this.close(chatId);
    }, CONFIG.sessionTimeoutMs);
    this.sessionTimers.set(chatId, timer);
  }

  private cleanup(chatId: number) {
    const idleTimer = this.idleTimers.get(chatId);
    if (idleTimer) clearTimeout(idleTimer);
    this.idleTimers.delete(chatId);

    const sessionTimer = this.sessionTimers.get(chatId);
    if (sessionTimer) clearTimeout(sessionTimer);
    this.sessionTimers.delete(chatId);

    this.sessions.delete(chatId);
  }
}
