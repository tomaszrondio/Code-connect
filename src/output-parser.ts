import { stripVTControlCharacters } from 'node:util';

export class OutputParser {
  private buffers = new Map<number, string>();
  private lastSent = new Map<number, string>();
  private inputEcho = new Map<number, string>();

  setInputEcho(chatId: number, input: string) {
    this.inputEcho.set(chatId, input);
  }

  processChunk(chatId: number, rawData: string): string | null {
    let clean = stripVTControlCharacters(rawData);

    clean = this.filterNoise(clean);

    const echo = this.inputEcho.get(chatId);
    if (echo && clean.includes(echo)) {
      clean = clean.replace(echo, '');
      this.inputEcho.delete(chatId);
    }

    clean = clean.trim();
    if (!clean || clean.length < 2) return null;

    const existing = this.buffers.get(chatId) ?? '';
    const updated = existing + (existing ? '\n' : '') + clean;
    this.buffers.set(chatId, updated);

    return updated;
  }

  flush(chatId: number): string {
    const content = this.buffers.get(chatId) ?? '';
    this.buffers.delete(chatId);
    this.lastSent.delete(chatId);
    return content;
  }

  hasChanged(chatId: number): boolean {
    const current = this.buffers.get(chatId) ?? '';
    const last = this.lastSent.get(chatId) ?? '';
    return current !== last;
  }

  markSent(chatId: number) {
    this.lastSent.set(chatId, this.buffers.get(chatId) ?? '');
  }

  private filterNoise(text: string): string {
    return text
      .replace(/[·✢✳✶✻✽⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '')
      .replace(/^(Thinking|Working|Reading|Searching|Editing|Running)\.{0,3}\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^>\s*$/gm, '')
      .replace(/[─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋]/g, '')
      .trim();
  }
}
