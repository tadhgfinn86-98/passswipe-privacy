'use strict';

const crypto = require('node:crypto');

// Ambiguous glyphs (O/0, I/1/L) are left out so nobody fails on a typo.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// 4x5 block font, one entry per character in ALPHABET.
const FONT = {
  A: [' ## ', '#  #', '####', '#  #', '#  #'],
  B: ['### ', '#  #', '### ', '#  #', '### '],
  C: [' ###', '#   ', '#   ', '#   ', ' ###'],
  D: ['### ', '#  #', '#  #', '#  #', '### '],
  E: ['####', '#   ', '### ', '#   ', '####'],
  F: ['####', '#   ', '### ', '#   ', '#   '],
  G: [' ###', '#   ', '# ##', '#  #', ' ###'],
  H: ['#  #', '#  #', '####', '#  #', '#  #'],
  J: ['  ##', '   #', '   #', '#  #', ' ## '],
  K: ['#  #', '# # ', '##  ', '# # ', '#  #'],
  M: ['#  #', '####', '####', '#  #', '#  #'],
  N: ['#  #', '## #', '# ##', '#  #', '#  #'],
  P: ['### ', '#  #', '### ', '#   ', '#   '],
  Q: [' ## ', '#  #', '#  #', '# ##', ' ###'],
  R: ['### ', '#  #', '### ', '# # ', '#  #'],
  S: [' ###', '#   ', ' ## ', '   #', '### '],
  T: ['####', ' ## ', ' ## ', ' ## ', ' ## '],
  U: ['#  #', '#  #', '#  #', '#  #', ' ## '],
  V: ['#  #', '#  #', '#  #', ' ## ', ' ## '],
  W: ['#  #', '#  #', '####', '####', '#  #'],
  X: ['#  #', ' ## ', ' ## ', ' ## ', '#  #'],
  Y: ['#  #', '#  #', ' ## ', ' ## ', ' ## '],
  Z: ['####', '   #', ' ## ', '#   ', '####'],
  2: ['### ', '   #', ' ## ', '#   ', '####'],
  3: ['####', '   #', ' ###', '   #', '####'],
  4: ['#  #', '#  #', '####', '   #', '   #'],
  5: ['####', '#   ', '### ', '   #', '### '],
  6: [' ###', '#   ', '### ', '#  #', ' ## '],
  7: ['####', '   #', '  # ', ' #  ', ' #  '],
  8: [' ## ', '#  #', ' ## ', '#  #', ' ## '],
  9: [' ## ', '#  #', ' ###', '   #', '### '],
};

function randomInt(maxExclusive) {
  return crypto.randomInt(maxExclusive);
}

function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/**
 * Render a code as block art, with light noise so it is not a plain string
 * an automated client can lift straight out of the message.
 */
function renderCode(code) {
  const noise = ['.', ',', '`', "'"];
  const lines = [];
  for (let row = 0; row < 5; row += 1) {
    const cells = [...code].map((char) => FONT[char][row]);
    const rendered = cells
      .join(' ')
      .replace(/ /g, () => (randomInt(7) === 0 ? noise[randomInt(noise.length)] : ' '));
    lines.push(rendered);
  }
  return lines.join('\n');
}

/** A small arithmetic question that is easy for a human and annoying to scrape. */
function mathChallenge() {
  const ops = [
    () => {
      const a = 2 + randomInt(18);
      const b = 2 + randomInt(18);
      return { question: `${a} + ${b}`, answer: String(a + b) };
    },
    () => {
      const a = 10 + randomInt(30);
      const b = 2 + randomInt(9);
      return { question: `${a} - ${b}`, answer: String(a - b) };
    },
    () => {
      const a = 2 + randomInt(10);
      const b = 2 + randomInt(10);
      return { question: `${a} x ${b}`, answer: String(a * b) };
    },
  ];
  return ops[randomInt(ops.length)]();
}

/** Build the challenge for a mode. `button` mode has nothing to solve. */
function createChallenge(mode) {
  if (mode === 'math') {
    const { question, answer } = mathChallenge();
    return { kind: 'math', prompt: question, answer };
  }
  const code = randomCode(6);
  return { kind: 'captcha', prompt: renderCode(code), answer: code };
}

/** Case- and whitespace-insensitive comparison, so "a4 k9p2" passes. */
function matches(answer, input) {
  const normalise = (value) => String(value).replace(/\s+/g, '').toUpperCase();
  return normalise(answer) === normalise(input);
}

module.exports = { ALPHABET, createChallenge, matches, randomCode, renderCode, mathChallenge };
