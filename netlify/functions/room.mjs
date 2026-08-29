import { getStore } from '@netlify/blobs';
import { handleRoomRequest } from './lib/handle.mjs';

export default async (request) => {
  const blobs = getStore({ name: 'keigo-rooms', consistency: 'strong' });
  return handleRoomRequest(request, {
    get: (key) => blobs.get(key, { type: 'json' }),
    set: (key, value) => blobs.setJSON(key, value)
  });
};

export const config = { path: '/api/room' };
