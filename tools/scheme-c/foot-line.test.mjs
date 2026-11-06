import { contentSpan, sameBuffer, spansMatch } from './foot-line.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rgba = Buffer.alloc(4 * 6 * 4);
rgba[(2 * 4 + 1) * 4 + 3] = 255;
rgba[(5 * 4 + 2) * 4 + 3] = 255;
const span = contentSpan(rgba, 4, 6);
assert(span.topY === 2 && span.footY === 5 && span.span === 4, 'span');
assert(spansMatch(32, 64, 64, 128) === true, 'same ratio');
assert(spansMatch(32, 64, 66, 128) === false, 'two pixels off');
assert(sameBuffer(Buffer.from([1]), Buffer.from([1])) === true, 'same');
assert(sameBuffer(Buffer.from([1]), Buffer.from([2])) === false, 'different');
console.log('ok');
