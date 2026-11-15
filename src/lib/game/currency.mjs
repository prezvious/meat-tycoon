function scaledCurrency(cents, exponent) {
  const divisor = 10n ** BigInt(exponent);
  const rounded = (cents + divisor / 2n) / divisor;
  return `${rounded / 100n}.${String(rounded % 100n).padStart(2, '0')}`;
}

function currencyCents(value) {
  const decimal = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(decimal)) {
    throw new Error('Currency must be a finite decimal string.');
  }
  const negative = decimal.startsWith('-');
  const [integer, fraction = ''] = decimal.replace(/^-/, '').split('.');
  const roundUp = BigInt((fraction + '000')[2] >= '5');
  const cents = BigInt(integer) * 100n + BigInt((fraction + '00').slice(0, 2)) + roundUp;
  return { cents, negative };
}

export function formatCurrency(value) {
  const { cents, negative } = currencyCents(value);
  const digits = (cents / 100n).toString().length;
  const prefix = negative && cents > 0n ? '-$' : '$';
  if (digits >= 16) return `${prefix}${scaledCurrency(cents, digits - 1)}e+${digits - 1}`;
  for (const [exponent, suffix] of [[12, 'T'], [9, 'B'], [6, 'M']]) {
    if (cents >= 100n * (10n ** BigInt(exponent))) {
      return `${prefix}${scaledCurrency(cents, exponent)}${suffix}`;
    }
  }
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${prefix}${whole}.${String(cents % 100n).padStart(2, '0')}`;
}
