import { ROOM_RE, MAX_BODY, sanitize } from './state.mjs';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

/**
 * ルーム状態 API の本体。
 * store は { get(key) -> Promise<state|null>, set(key, state) -> Promise<void> } を満たすもの。
 * Netlify Blobs でもテスト用の Map でも動くよう、ストレージだけ差し替えられるようにしている。
 */
export async function handleRoomRequest(request, store) {
  const url = new URL(request.url);
  const room = (url.searchParams.get('room') || '').trim().toUpperCase();
  if (!ROOM_RE.test(room)) return json({ error: 'invalid_room' }, 400);

  if (request.method === 'GET') {
    const state = await store.get(room);
    return json({ state: state ?? null });
  }

  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'bad_json' }, 400);
    }

    const next = sanitize(parsed);
    if (!next) return json({ error: 'bad_state' }, 400);

    // 楽観ロック: 自分が読んだ版より新しい版が既にあれば書き込まず、最新を返す
    const current = await store.get(room);
    if (current && (current.rev || 0) >= next.rev) {
      return json({ conflict: true, state: current }, 409);
    }

    await store.set(room, next);
    return json({ state: next });
  }

  return json({ error: 'method_not_allowed' }, 405);
}
