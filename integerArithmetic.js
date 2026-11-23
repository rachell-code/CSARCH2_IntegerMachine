/**
 * Signed integer arithmetic with register-level step traces.
 *
 * INPUT RULES
 * - Decimal values: pass a JS number (13, -13) or a decimal string ('13', '-13').
 * - Binary values: pass a string prefixed with 0b, e.g. '0b1101'. The bit pattern
 *   is interpreted as two's complement using its own length, then range-checked
 *   against the supplied `bits` size. With bits = 4, '0b1101' means -3.
 *   Do not prefix binary strings with + or -.
 * - `bits` is the operand width and must be an integer from 2 to 64.
 *
 * EXAMPLES
 *   sequentialMultiply(13, '0b0011', 4)
 *   sequentialMultiply('0b1101', -3, 4)
 *   nonRestoringDivide('0b1110', 3, 4)
 *   nonRestoringDivide(-14, '0b11101', 4)
 */

const MAX_SUPPORTED_BITS = 64;

function assertBits(bits) {
  if (!Number.isInteger(bits) || bits < 2 || bits > MAX_SUPPORTED_BITS) {
    throw new RangeError(`bits must be an integer from 2 to ${MAX_SUPPORTED_BITS}.`);
  }
}

function maskFor(width) {
  return (1n << BigInt(width)) - 1n;
}

function bitLength(value) {
  const magnitude = value < 0n ? -value : value;
  return magnitude === 0n ? 1 : magnitude.toString(2).length;
}

function toBits(value, width) {
  const bits = new Array(width);

  for (let i = 0; i < width; i++) {
    bits[width - 1 - i] = Number((value >> BigInt(i)) & 1n);
  }

  return bits;
}

function fromUnsignedBits(bits) {
  let value = 0n;

  for (const bit of bits) {
    value = (value << 1n) | BigInt(bit);
  }

  return value;
}

function fromSignedBits(bits) {
  const unsigned = fromUnsignedBits(bits);
  return bits[0] === 1 ? unsigned - (1n << BigInt(bits.length)) : unsigned;
}

function bitsToString(bits) {
  return bits.join('');
}

function padLeft(bits, width) {
  return new Array(width - bits.length).fill(0).concat(bits);
}

function toPlainNumber(value) {
  const min = BigInt(Number.MIN_SAFE_INTEGER);
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return value >= min && value <= max ? Number(value) : value.toString();
}

function signedRange(bits) {
  const limit = 1n << BigInt(bits - 1);
  return { min: -limit, max: limit - 1n };
}

function parseOperand(input, bits, label) {
  let value;
  let format;

  if (typeof input === 'bigint') {
    value = input;
    format = 'bigint decimal';
  } else if (typeof input === 'number') {
    if (!Number.isSafeInteger(input)) {
      throw new TypeError(`${label} must be a safe integer number or a valid string.`);
    }
    value = BigInt(input);
    format = 'decimal number';
  } else if (typeof input === 'string') {
    const text = input.trim();

    if (/^0[bB][01]+$/.test(text)) {
      const pattern = text.slice(2);
      if (pattern.length > MAX_SUPPORTED_BITS) {
        throw new RangeError(`${label} binary string exceeds ${MAX_SUPPORTED_BITS} bits.`);
      }
      value = fromSignedBits(pattern.split('').map(Number));
      format = "binary string (two's complement)";
    } else if (/^-?\d+$/.test(text)) {
      value = BigInt(text);
      format = 'decimal string';
    } else {
      throw new TypeError(
        `${label} must be a decimal number, a decimal string, or a binary string prefixed with 0b.`
      );
    }
  } else {
    throw new TypeError(
      `${label} must be a decimal number, a decimal string, or a binary string prefixed with 0b.`
    );
  }

  const range = signedRange(bits);
  if (value < range.min || value > range.max) {
    throw new RangeError(
      `${label} value ${value.toString()} is outside the ${bits}-bit signed range ` +
        `[${range.min.toString()}, ${range.max.toString()}].`
    );
  }

  const signedBits = toBits(value, bits);
  const magnitude = value < 0n ? -value : value;
  const magnitudeWidth = Math.max(bits, bitLength(magnitude));
  const magnitudeBits = toBits(magnitude, magnitudeWidth);

  return {
    raw: input,
    format,
    value,
    negative: value < 0n,
    decimal: toPlainNumber(value),
    decimalString: value.toString(),
    binary: bitsToString(signedBits),
    binaryArray: signedBits,
    magnitude,
    magnitudeDecimal: toPlainNumber(magnitude),
    magnitudeBinary: bitsToString(magnitudeBits),
    magnitudeBinaryArray: magnitudeBits
  };
}

function publicOperand(operand) {
  return {
    raw: operand.raw,
    format: operand.format,
    decimal: operand.decimal,
    decimalString: operand.decimalString,
    binary: operand.binary,
    negative: operand.negative,
    magnitudeDecimal: operand.magnitudeDecimal,
    magnitudeBinary: operand.magnitudeBinary
  };
}

function buildExplanation(steps) {
  return steps.map((entry) => {
    const parts = [`Step ${entry.step}: ${entry.action}`, `A=${entry.A}`, `Q=${entry.Q}`];

    if (entry.M !== undefined) parts.push(`M=${entry.M}`);
    if (entry.Q0 !== undefined) parts.push(`Q0=${entry.Q0}`);
    if (entry.count !== undefined) parts.push(`count=${entry.count}`);
    if (entry.note) parts.push(`(${entry.note})`);

    return parts.join(' | ');
  });
}

function shiftRightPair(aBits, qBits) {
  const carriedBit = aBits[aBits.length - 1];
  const shiftedA = aBits.slice();
  const shiftedQ = qBits.slice();

  for (let i = aBits.length - 1; i > 0; i--) {
    shiftedA[i] = aBits[i - 1];
  }
  shiftedA[0] = 0;

  for (let i = qBits.length - 1; i > 0; i--) {
    shiftedQ[i] = qBits[i - 1];
  }
  shiftedQ[0] = carriedBit;

  return [shiftedA, shiftedQ];
}

function shiftLeftPair(aBits, qBits) {
  return [aBits.slice(1).concat(qBits[0]), qBits.slice(1).concat(0)];
}

/**
 * Multiplies two signed operands with the sequential add-and-shift multiplier.
 *
 * @param {number|bigint|string} inputA decimal number or 0b-prefixed binary string
 * @param {number|bigint|string} inputB decimal number or 0b-prefixed binary string
 * @param {number} bits operand width in bits (2..64)
 * @returns {object} structured register trace, explanation lines, and final product
 */
export function sequentialMultiply(inputA, inputB, bits) {
  assertBits(bits);

  const multiplicand = parseOperand(inputA, bits, 'Multiplicand');
  const multiplier = parseOperand(inputB, bits, 'Multiplier');

  const workWidth = Math.max(
    bits,
    multiplicand.magnitudeBinaryArray.length,
    multiplier.magnitudeBinaryArray.length
  );
  const accumulatorWidth = workWidth + 1;
  const mask = maskFor(accumulatorWidth);

  let A = new Array(accumulatorWidth).fill(0);
  let Q = padLeft(multiplier.magnitudeBinaryArray, workWidth);
  const M = padLeft(multiplicand.magnitudeBinaryArray, accumulatorWidth);

  const steps = [
    {
      step: 0,
      action: 'Initialize registers for sequential multiplication',
      A: bitsToString(A),
      Q: bitsToString(Q),
      M: bitsToString(M),
      Q0: Q[Q.length - 1],
      count: workWidth,
      note: `A = 0, Q = |multiplier| = ${multiplier.magnitudeDecimal}, ` +
        `M = |multiplicand| = ${multiplicand.magnitudeDecimal}; ` +
        `signs will be applied after the magnitude is formed.`
    }
  ];

  let count = workWidth;

  while (count > 0) {
    const q0 = Q[Q.length - 1];
    const beforeA = A.slice();

    if (q0 === 1) {
      A = toBits((fromUnsignedBits(A) + fromUnsignedBits(M)) & mask, accumulatorWidth);
      steps.push({
        step: steps.length,
        action: 'Q0 = 1, so add M to A',
        A: bitsToString(A),
        Q: bitsToString(Q),
        M: bitsToString(M),
        Q0: q0,
        count,
        note: `A = ${fromUnsignedBits(beforeA).toString()} + ` +
          `${fromUnsignedBits(M).toString()} = ${fromUnsignedBits(A).toString()}.`
      });
    } else {
      steps.push({
        step: steps.length,
        action: 'Q0 = 0, so A is unchanged',
        A: bitsToString(A),
        Q: bitsToString(Q),
        M: bitsToString(M),
        Q0: q0,
        count,
        note: `A remains ${fromUnsignedBits(A).toString()}.`
      });
    }

    [A, Q] = shiftRightPair(A, Q);
    count -= 1;

    steps.push({
      step: steps.length,
      action: 'Shift A and Q right one bit',
      A: bitsToString(A),
      Q: bitsToString(Q),
      M: bitsToString(M),
      Q0: q0,
      count,
      note: `The old A LSB (${beforeA[beforeA.length - 1]}) moved into the Q MSB.`
    });
  }

  const magnitude = fromUnsignedBits(A.concat(Q)) & maskFor(2 * bits);
  const resultNegative = multiplicand.negative !== multiplier.negative;
  const product = resultNegative ? -magnitude : magnitude;
  const productBits = toBits(product, 2 * bits);
  const productRange = signedRange(2 * bits);
  const overflow = product < productRange.min || product > productRange.max;

  steps.push({
    step: steps.length,
    action: 'Apply the operand signs to the product magnitude',
    A: bitsToString(A),
    Q: bitsToString(Q),
    M: bitsToString(M),
    count: 0,
    note: `Operand signs ${multiplicand.negative ? 'negative' : 'positive'} and ` +
      `${multiplier.negative ? 'negative' : 'positive'} give a ` +
      `${resultNegative ? 'negative' : 'positive'} product: ${product.toString()}.`
  });

  return {
    operation: 'sequential binary multiplication',
    bits,
    representation: "two's complement",
    inputs: {
      multiplicand: publicOperand(multiplicand),
      multiplier: publicOperand(multiplier)
    },
    steps,
    explanation: buildExplanation(steps),
    result: {
      binary: bitsToString(productBits),
      decimal: toPlainNumber(product),
      decimalString: product.toString(),
      magnitudeBinary: magnitude.toString(2).padStart(2 * bits, '0'),
      overflow
    }
  };
}

/**
 * Divides two signed operands with the non-restoring division algorithm.
 *
 * @param {number|bigint|string} dividendInput decimal number or 0b-prefixed binary string
 * @param {number|bigint|string} divisorInput decimal number or 0b-prefixed binary string
 * @param {number} bits operand width in bits (2..64)
 * @returns {object} structured register trace, explanation lines, quotient, and remainder
 */
export function nonRestoringDivide(dividendInput, divisorInput, bits) {
  assertBits(bits);

  const dividend = parseOperand(dividendInput, bits, 'Dividend');
  const divisor = parseOperand(divisorInput, bits, 'Divisor');

  if (divisor.value === 0n) {
    throw new RangeError('Divisor cannot be zero.');
  }

  const workWidth = Math.max(
    bits,
    dividend.magnitudeBinaryArray.length,
    divisor.magnitudeBinaryArray.length
  );
  const accumulatorWidth = workWidth + 1;
  const mask = maskFor(accumulatorWidth);

  let A = new Array(accumulatorWidth).fill(0);
  let Q = padLeft(dividend.magnitudeBinaryArray, workWidth);
  const M = padLeft(divisor.magnitudeBinaryArray, accumulatorWidth);

  const steps = [
    {
      step: 0,
      action: 'Initialize registers for non-restoring division',
      A: bitsToString(A),
      Q: bitsToString(Q),
      M: bitsToString(M),
      Q0: Q[Q.length - 1],
      count: workWidth,
      note: `A = 0, Q = |dividend| = ${dividend.magnitudeDecimal}, ` +
        `M = |divisor| = ${divisor.magnitudeDecimal}.`
    }
  ];

  let count = workWidth;

  while (count > 0) {
    const previousNegative = A[0] === 1;
    const beforeA = A.slice();
    const beforeQ = Q.slice();

    [A, Q] = shiftLeftPair(A, Q);
    const shiftedA = A.slice();

    if (previousNegative) {
      A = toBits((fromUnsignedBits(A) + fromUnsignedBits(M)) & mask, accumulatorWidth);
    } else {
      A = toBits((fromUnsignedBits(A) - fromUnsignedBits(M)) & mask, accumulatorWidth);
    }

    const q0 = A[0] === 0 ? 1 : 0;
    Q[Q.length - 1] = q0;
    count -= 1;

    steps.push({
      step: steps.length,
      action: `Shift A and Q left; ${previousNegative ? 'A = A + M' : 'A = A - M'}; set Q0 = ${q0}`,
      A: bitsToString(A),
      Q: bitsToString(Q),
      M: bitsToString(M),
      Q0: q0,
      count,
      beforeA: bitsToString(beforeA),
      shiftedA: bitsToString(shiftedA),
      note: `Previous A was ${previousNegative ? 'negative' : 'non-negative'}; ` +
        `new A is ${A[0] === 1 ? 'negative' : 'non-negative'}. ` +
        `Old Q was ${bitsToString(beforeQ)}.`
    });
  }

  if (A[0] === 1) {
    const beforeCorrection = A.slice();
    A = toBits((fromUnsignedBits(A) + fromUnsignedBits(M)) & mask, accumulatorWidth);
    steps.push({
      step: steps.length,
      action: 'Final correction: A was negative, so add M back once',
      A: bitsToString(A),
      Q: bitsToString(Q),
      M: bitsToString(M),
      count: 0,
      note: `A changed from ${bitsToString(beforeCorrection)} to ${bitsToString(A)}.`
    });
  } else {
    steps.push({
      step: steps.length,
      action: 'Final check: A is non-negative, so no correction is needed',
      A: bitsToString(A),
      Q: bitsToString(Q),
      M: bitsToString(M),
      count: 0,
      note: 'The remainder magnitude is already valid.'
    });
  }

  const quotientMagnitude = fromUnsignedBits(Q);
  const remainderMagnitude = fromUnsignedBits(A);
  const signsDiffer = dividend.negative !== divisor.negative;
  const quotient = signsDiffer && quotientMagnitude !== 0n
    ? -quotientMagnitude
    : quotientMagnitude;
  const remainder = dividend.negative && remainderMagnitude !== 0n
    ? -remainderMagnitude
    : remainderMagnitude;

  const quotientRange = signedRange(bits);
  const quotientOverflow = quotient < quotientRange.min || quotient > quotientRange.max;
  const quotientWidth = quotientOverflow ? bits + 1 : bits;
  const quotientBits = toBits(quotient, quotientWidth);
  const remainderBits = toBits(remainder, bits);
  const identityHolds = dividend.value === quotient * divisor.value + remainder;

  steps.push({
    step: steps.length,
    action: 'Apply signs to quotient and remainder',
    A: bitsToString(remainderBits),
    Q: bitsToString(quotientBits),
    M: bitsToString(M),
    count: 0,
    note: `Dividend (${dividend.value.toString()}) = ` +
      `quotient (${quotient.toString()}) * divisor (${divisor.value.toString()}) + ` +
      `remainder (${remainder.toString()}).`
  });

  const result = {
    binary: bitsToString(quotientBits),
    decimal: toPlainNumber(quotient),
    decimalString: quotient.toString(),
    quotient: {
      binary: bitsToString(quotientBits),
      decimal: toPlainNumber(quotient),
      decimalString: quotient.toString(),
      bitWidth: quotientWidth
    },
    remainder: {
      binary: bitsToString(remainderBits),
      decimal: toPlainNumber(remainder),
      decimalString: remainder.toString()
    },
    overflow: quotientOverflow,
    identityHolds
  };

  if (quotientOverflow) {
    result.fullQuotient = {
      binary: bitsToString(toBits(quotient, bits + 1)),
      decimal: toPlainNumber(quotient),
      decimalString: quotient.toString(),
      bitWidth: bits + 1
    };
  }

  return {
    operation: 'non-restoring division',
    bits,
    representation: "two's complement",
    inputs: {
      dividend: publicOperand(dividend),
      divisor: publicOperand(divisor)
    },
    steps,
    explanation: buildExplanation(steps),
    result
  };
}
