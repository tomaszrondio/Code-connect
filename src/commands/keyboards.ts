import { InlineKeyboard } from 'grammy';
import { readdirSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config.js';

export function getCustomCommandsKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const commandsDir = join(CONFIG.projectDir, '.claude', 'commands');

  try {
    const files = readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    files.forEach((file, i) => {
      const name = file.replace('.md', '');
      keyboard.text(name, `cc:${name}`);
      if (i % 2 === 1) keyboard.row();
    });
    if (files.length % 2 === 1) keyboard.row();
  } catch {
    // Directory doesn't exist — skip
  }
  return keyboard;
}

export function getMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Continue session', 'act:continue')
    .text('Clear', 'act:clear').row()
    .text('Compact', 'act:compact')
    .text('Cost', 'act:cost').row()
    .text('Model', 'act:model')
    .text('Memory', 'act:memory').row()
    .text('Custom commands', 'act:commands')
    .text('Close session', 'act:close');
}

export function getModelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Sonnet', 'model:sonnet').row()
    .text('Opus', 'model:opus').row()
    .text('Haiku', 'model:haiku').row()
    .text('<< Menu', 'act:menu');
}
