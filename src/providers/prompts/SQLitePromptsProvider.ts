import { Prompt, PromptInput } from '../../types/Prompt';
import { getDb } from '../storage/SQLiteStorageProvider';
import { PromptsProvider } from './PromptsProvider';

function rowToPrompt(row: Record<string, unknown>): Prompt {
  return {
    id: row.id as number,
    actionId: row.action_id as number,
    name: row.name as string,
    body: row.body as string,
    isDefault: row.is_default === 1 || row.is_default === true,
    createdAt: row.created_at as number,
  };
}

const SQLitePromptsProvider: PromptsProvider = {
  async getAllPrompts() {
    const result = getDb().executeSync(
      'SELECT * FROM prompts ORDER BY action_id ASC, is_default DESC, created_at ASC',
    );
    return (result.rows ?? []).map(rowToPrompt);
  },

  async getDefaultPrompt(actionId) {
    const result = getDb().executeSync(
      'SELECT * FROM prompts WHERE action_id = ? AND is_default = 1 ORDER BY created_at ASC LIMIT 1',
      [actionId],
    );
    if (!result.rows || result.rows.length === 0) return null;
    return rowToPrompt(result.rows[0]);
  },

  async savePrompt(prompt) {
    const db = getDb();
    const now = prompt.createdAt ?? Date.now();
    if (prompt.isDefault) {
      db.executeSync('UPDATE prompts SET is_default = 0 WHERE action_id = ?', [prompt.actionId]);
    }
    const result = db.executeSync(
      'INSERT INTO prompts (action_id, name, body, is_default, created_at) VALUES (?, ?, ?, ?, ?)',
      [prompt.actionId, prompt.name, prompt.body, prompt.isDefault ? 1 : 0, now],
    );
    return { ...prompt, id: result.insertId as number, createdAt: now };
  },

  async updatePrompt(prompt) {
    const db = getDb();
    if (prompt.isDefault) {
      db.executeSync('UPDATE prompts SET is_default = 0 WHERE action_id = ?', [prompt.actionId]);
    }
    db.executeSync(
      'UPDATE prompts SET name = ?, body = ?, is_default = ? WHERE id = ?',
      [prompt.name, prompt.body, prompt.isDefault ? 1 : 0, prompt.id],
    );
  },

  async setDefaultPrompt(actionId, promptId) {
    const db = getDb();
    db.executeSync('UPDATE prompts SET is_default = 0 WHERE action_id = ?', [actionId]);
    db.executeSync('UPDATE prompts SET is_default = 1 WHERE id = ? AND action_id = ?', [promptId, actionId]);
  },
};

export default SQLitePromptsProvider;
