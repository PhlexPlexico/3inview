import type { Frame, isPressed, FRAME_SIZE } from './types/frame';

export function decode(buf: Uint8Array): Frame {
  if (buf[0] !== 0x49 || buf[1] !== 0x33) throw new Error('bad magic');
  if (buf[2] !== 4) throw new Error('unsupported protocol version ' + buf[2]);

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    seq: buf[3]!,
    buttons: view.getUint32(4, true),
    cp: [view.getInt16(8, true), view.getInt16(10, true)],
    tp: [view.getInt16(12, true), view.getInt16(14, true)],
    cs: [view.getInt16(16, true), view.getInt16(18, true)],
    ir: buf[20]!,
    csStatus: buf[21]!,
    wifi: buf[22]!,
    wifiRecoveries: buf[23]!,
    irError: view.getUint32(24, true),
    csError: view.getUint32(28, true),
  };
}

