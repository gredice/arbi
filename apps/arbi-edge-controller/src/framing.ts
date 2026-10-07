import { MAX_MESSAGE_BYTES } from '@arbi/protocol';
import { TextDecoder } from 'node:util';

/** Fixed allocation; reject the advertised size before copying a payload. */
export class FrameDecoder {
  #header = Buffer.alloc(4);
  #payload = Buffer.alloc(MAX_MESSAGE_BYTES);
  #headerUsed = 0;
  #used = 0;
  #length = 0;
  push(chunk: Buffer, receive: (input: unknown) => void): void {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.#headerUsed < 4) {
        const n = Math.min(4 - this.#headerUsed, chunk.length - offset);
        chunk.copy(this.#header, this.#headerUsed, offset, offset + n);
        offset += n; this.#headerUsed += n;
        if (this.#headerUsed < 4) continue;
        this.#length = this.#header.readUInt32BE();
        if (this.#length === 0 || this.#length > MAX_MESSAGE_BYTES) throw new Error('FRAME_SIZE');
      }
      const n = Math.min(this.#length - this.#used, chunk.length - offset);
      chunk.copy(this.#payload, this.#used, offset, offset + n);
      offset += n; this.#used += n;
      if (this.#used === this.#length) {
        const json = new TextDecoder('utf-8', { fatal: true }).decode(this.#payload.subarray(0, this.#length));
        this.#headerUsed = 0; this.#used = 0;
        receive(JSON.parse(json));
      }
    }
  }
}
export function frame(input: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(input));
  if (body.length === 0 || body.length > MAX_MESSAGE_BYTES) throw new Error('FRAME_SIZE');
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}
