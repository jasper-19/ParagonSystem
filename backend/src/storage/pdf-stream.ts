import { Transform } from 'node:stream';

export function exactPdfBytes(expected: number): Transform {
  let received = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length;
      if (received > expected) done(new Error('Invalid PDF response size'));
      else done(null, chunk);
    },
    flush(done) { done(received === expected ? undefined : new Error('Incomplete PDF response')); },
  });
}
