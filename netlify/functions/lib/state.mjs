export const ROOM_RE = /^[A-Z0-9-]{1,10}$/;
export const MAX_BODY = 8000;
export const MAX_PLAYERS = 8;
export const MAX_NAME = 14;
export const MAX_COUNT = 9999;

/**
 * 受け取った状態を検証・正規化する。
 * 共有ルームは誰でも書き込めるので、保存前にサーバ側で必ず整える。
 * 不正なら null を返す。
 */
export function sanitize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (!Array.isArray(input.players)) return null;
  if (input.players.length === 0 || input.players.length > MAX_PLAYERS) return null;

  const rev = Number(input.rev);
  if (!Number.isFinite(rev) || rev < 0) return null;

  const seen = new Set();
  const players = [];
  for (const raw of input.players) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' ? raw.id.slice(0, 40) : '';
    if (!id || seen.has(id)) return null;
    seen.add(id);
    const name = typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME) : '';
    const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(Number(raw.count) || 0)));
    players.push({ id, name, count });
  }
  return { rev: Math.trunc(rev), players };
}
