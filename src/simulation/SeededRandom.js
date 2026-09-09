export function createSeededRandom(seed) {
  let state = normalizeSeed(seed);

  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
  };
}

function normalizeSeed(seed) {
  if (!Number.isInteger(seed)) {
    return 0;
  }

  return seed >>> 0;
}
