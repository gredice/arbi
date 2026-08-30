const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

export class Decimal {
  readonly coefficient: bigint;
  readonly scale: number;

  private constructor(coefficient: bigint, scale: number) {
    let normalizedCoefficient = coefficient;
    let normalizedScale = scale;
    while (normalizedScale > 0 && normalizedCoefficient % 10n === 0n) {
      normalizedCoefficient /= 10n;
      normalizedScale -= 1;
    }
    this.coefficient = normalizedCoefficient;
    this.scale = normalizedScale;
  }

  static parse(value: string): Decimal {
    if (!DECIMAL_PATTERN.test(value)) {
      throw new Error(`Invalid non-negative decimal string: ${value}`);
    }
    const [whole, fraction = ""] = value.split(".");
    return new Decimal(BigInt(`${whole}${fraction}`), fraction.length);
  }

  static fromBigInt(value: bigint): Decimal {
    return new Decimal(value, 0);
  }

  static fromScaled(coefficient: bigint, scale: number): Decimal {
    return new Decimal(coefficient, scale);
  }

  static zero(): Decimal {
    return Decimal.fromBigInt(0n);
  }

  add(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale);
    const left = this.coefficient * powerOfTen(scale - this.scale);
    const right = other.coefficient * powerOfTen(scale - other.scale);
    return new Decimal(left + right, scale);
  }

  subtract(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale);
    const left = this.coefficient * powerOfTen(scale - this.scale);
    const right = other.coefficient * powerOfTen(scale - other.scale);
    if (right > left) {
      throw new Error("Decimal subtraction would become negative");
    }
    return new Decimal(left - right, scale);
  }

  multiply(other: Decimal): Decimal {
    return new Decimal(
      this.coefficient * other.coefficient,
      this.scale + other.scale,
    );
  }

  multiplyInteger(value: bigint): Decimal {
    return new Decimal(this.coefficient * value, this.scale);
  }

  compare(other: Decimal): number {
    const scale = Math.max(this.scale, other.scale);
    const left = this.coefficient * powerOfTen(scale - this.scale);
    const right = other.coefficient * powerOfTen(scale - other.scale);
    return left < right ? -1 : left > right ? 1 : 0;
  }

  round(scale: number): Decimal {
    if (this.scale <= scale) {
      return this;
    }
    const divisor = powerOfTen(this.scale - scale);
    const quotient = this.coefficient / divisor;
    const remainder = this.coefficient % divisor;
    const rounded =
      remainder * 2n >= divisor ? quotient + 1n : quotient;
    return new Decimal(rounded, scale);
  }

  toString(): string {
    if (this.scale === 0) {
      return this.coefficient.toString();
    }
    const digits = this.coefficient.toString().padStart(this.scale + 1, "0");
    return `${digits.slice(0, -this.scale)}.${digits.slice(-this.scale)}`;
  }

  toFixed(scale: number): string {
    const rounded = this.round(scale);
    const value = rounded.toString();
    const [whole, fraction = ""] = value.split(".");
    return scale === 0
      ? whole
      : `${whole}.${fraction.padEnd(scale, "0")}`;
  }
}

export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_PATTERN.test(value);
}

export function ceilRatio(numerator: Decimal, denominator: Decimal): bigint {
  if (denominator.coefficient === 0n) {
    throw new Error("Cannot divide by zero");
  }
  const scale = Math.max(numerator.scale, denominator.scale);
  const left = numerator.coefficient * powerOfTen(scale - numerator.scale);
  const right =
    denominator.coefficient * powerOfTen(scale - denominator.scale);
  return (left + right - 1n) / right;
}

export function roundUpToIncrement(
  value: bigint,
  minimum: bigint,
  increment: bigint,
): bigint {
  if (minimum < 1n || increment < 1n) {
    throw new Error("Minimum and increment must be positive integers");
  }
  if (value <= minimum) {
    return minimum;
  }
  return minimum + ((value - minimum + increment - 1n) / increment) * increment;
}
