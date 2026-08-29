export function memoryStore() {
  const map = new Map();
  return {
    get: async (key) => (map.has(key) ? JSON.parse(map.get(key)) : null),
    set: async (key, value) => { map.set(key, JSON.stringify(value)); }
  };
}
