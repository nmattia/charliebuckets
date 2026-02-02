// Pair of pins set as output for the given element
export type PinPair = {
  high: number; // The pin set high
  low: number; // The pin set low
};

export function* grid(n_pins: number): Generator<PinPair> {
  const W = n_pins;
  const H = n_pins - 1;

  const fn = (x: number, y: number) => (((y * (y + 1)) / 2) % W) + x;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hi = fn(x, y);
      const lo = fn(x, y + 1);
      yield { high: hi, low: lo };
    }
  }
}

export function* pio(n_pins: number): Generator<PinPair> {
  let pat = (1 << (n_pins - 1)) | 0b1;

  while (true) {
    // 0-based pins
    //
    //       lsb == 1
    //         v
    // 0b00100010
    //     ^
    //     msb == 5

    const msb1 = 32 - Math.clz32(pat) - 1;
    const lsb1 = 32 - Math.clz32(pat & ~(pat - 1)) - 1;
    yield { high: msb1, low: lsb1 };
    yield { high: lsb1, low: msb1 };

    if (msb1 === 1 && lsb1 === 0) {
      // both bits are to the right< eg 0b00000011
      return;
    } else if (lsb1 === 0) {
      // We've reached the LSB, eg 0b00100001
      pat = (1 << (n_pins - 1)) | (1 << (n_pins - msb1));
    } else {
      pat = pat >> 1;
    }
  }
}
