import { describe, it, expect } from 'vitest';
import golden from './golden_bytes.json' with { type: 'json' };
import { decode } from '../server/decode';

describe('decode', () => {
  for (const c of golden.cases) {
    if ('expected' in c && c.hex !== undefined) {
      it(c.name, () => expect(decode(Buffer.from(c.hex, 'hex'))).toMatchObject(c.expected));
    } else if ('error' in c && c.hex !== undefined) {
      it(c.name, () => expect(() => decode(Buffer.from(c.hex, 'hex'))).toThrow(c.error));
    }
  }
});