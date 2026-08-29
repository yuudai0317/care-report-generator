import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRoomRequest } from '../netlify/functions/lib/handle.mjs';
import { memoryStore } from './memory-store.mjs';

const URL_FOR = (room) => `https://example.test/api/room?room=${encodeURIComponent(room)}`;
const get = (store, room) => handleRoomRequest(new Request(URL_FOR(room)), store);
const put = (store, room, body) =>
  handleRoomRequest(
    new Request(URL_FOR(room), {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }),
    store
  );

const seed = { rev: 1, players: [{ id: 'p1', name: 'ゆうだい', count: 0 }] };

test('未作成のルームは state:null を返す', async () => {
  const res = await get(memoryStore(), 'MERIT');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { state: null });
});

test('PUT した状態が GET で読み出せる', async () => {
  const store = memoryStore();
  assert.equal((await put(store, 'MERIT', seed)).status, 200);
  const body = await (await get(store, 'MERIT')).json();
  assert.deepEqual(body.state, seed);
});

test('ルーム名は正規化され、別ルームは混ざらない', async () => {
  const store = memoryStore();
  await put(store, 'merit', seed);
  assert.deepEqual((await (await get(store, 'MERIT')).json()).state, seed);
  assert.equal((await (await get(store, 'OTHER')).json()).state, null);
});

test('不正なルーム名は 400', async () => {
  for (const room of ['', '敬語', 'A B', 'TOOOOOOLONGX']) {
    assert.equal((await get(memoryStore(), room)).status, 400, room);
  }
});

test('古い rev の書き込みは 409 で最新を返す', async () => {
  const store = memoryStore();
  await put(store, 'MERIT', { rev: 5, players: [{ id: 'p1', name: 'A', count: 3 }] });
  const res = await put(store, 'MERIT', { rev: 5, players: [{ id: 'p1', name: 'A', count: 1 }] });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.conflict, true);
  assert.equal(body.state.players[0].count, 3);
});

test('新しい rev は上書きできる', async () => {
  const store = memoryStore();
  await put(store, 'MERIT', { rev: 5, players: [{ id: 'p1', name: 'A', count: 3 }] });
  const res = await put(store, 'MERIT', { rev: 6, players: [{ id: 'p1', name: 'A', count: 4 }] });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state.players[0].count, 4);
});

test('壊れた状態は 400 で保存しない', async () => {
  const store = memoryStore();
  const bad = [
    'not json',
    JSON.stringify({ rev: 1 }),
    JSON.stringify({ rev: 1, players: [] }),
    JSON.stringify({ rev: -1, players: [{ id: 'p1', name: '', count: 0 }] }),
    JSON.stringify({ rev: 1, players: [{ id: '', name: '', count: 0 }] }),
    JSON.stringify({ rev: 1, players: [{ id: 'p1', count: 0 }, { id: 'p1', count: 0 }] }),
    JSON.stringify({ rev: 1, players: Array.from({ length: 9 }, (_, i) => ({ id: 'p' + i, count: 0 })) })
  ];
  for (const body of bad) {
    assert.equal((await put(store, 'MERIT', body)).status, 400, body.slice(0, 40));
  }
  assert.equal((await (await get(store, 'MERIT')).json()).state, null);
});

test('名前と回数はサーバ側で丸められる', async () => {
  const store = memoryStore();
  await put(store, 'MERIT', {
    rev: 1,
    players: [{ id: 'p1', name: 'あ'.repeat(50), count: -8 }, { id: 'p2', name: 'B', count: 99999 }]
  });
  const state = (await (await get(store, 'MERIT')).json()).state;
  assert.equal(state.players[0].name.length, 14);
  assert.equal(state.players[0].count, 0);
  assert.equal(state.players[1].count, 9999);
});

test('大きすぎるボディは 413', async () => {
  const res = await put(memoryStore(), 'MERIT', 'x'.repeat(8001));
  assert.equal(res.status, 413);
});

test('未対応メソッドは 405', async () => {
  const res = await handleRoomRequest(
    new Request(URL_FOR('MERIT'), { method: 'DELETE' }),
    memoryStore()
  );
  assert.equal(res.status, 405);
});
