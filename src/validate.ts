export type ValidationError = 'EMPTY' | 'FORMAT' | 'CHECKSUM' | 'UNKNOWN' | 'MISMATCH';

export type Validation =
  | { readonly valid: true; readonly value: string }
  | { readonly valid: false; readonly error: ValidationError; readonly message: string };

const fail = (error: ValidationError, message: string): Validation => ({ valid: false, error, message });

const clean = (input: string): string => input.replace(/[\s-]/g, '');

const weighted = (digits: string, weights: readonly number[]): number =>
  weights.reduce((sum, weight, index) => sum + weight * Number(digits[index]), 0);

const check = (input: string, name: string, pattern: RegExp, expected: string, test: (value: string) => boolean): Validation => {
  const value = clean(input);
  if (!value) return fail('EMPTY', `${name} is empty`);
  if (!pattern.test(value)) return fail('FORMAT', `${name} must be ${expected}`);
  return test(value) ? { valid: true, value } : fail('CHECKSUM', `${name} has a wrong check digit`);
};

const INN10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const ACCOUNT = Array.from({ length: 23 }, (_, index) => [7, 1, 3][index % 3] ?? 0);

/**
 * Checks an INN: 10 digits for organizations, 12 for individuals.
 *
 * @example
 * ```ts
 * validateInn('7707083893'); // { valid: true, value: '7707083893' }
 * validateInn('7707083894'); // { valid: false, error: 'CHECKSUM', ... }
 * ```
 */
export const validateInn = (input: string): Validation =>
  check(input, 'INN', /^\d{10}(\d{2})?$/, '10 or 12 digits', (value) =>
    value.length === 10
      ? (weighted(value, INN10) % 11) % 10 === Number(value[9])
      : (weighted(value, INN11) % 11) % 10 === Number(value[10]) && (weighted(value, INN12) % 11) % 10 === Number(value[11]));

/** Checks a KPP: 9 characters, the 5th and 6th may be Latin capitals. KPP has no check digit. */
export const validateKpp = (input: string): Validation => check(input, 'KPP', /^\d{4}[\dA-Z]{2}\d{3}$/, '4 digits, 2 digits or capitals, 3 digits', () => true);

/** Checks an OGRN of an organization: 13 digits. */
export const validateOgrn = (input: string): Validation =>
  check(input, 'OGRN', /^\d{13}$/, '13 digits', (value) => (BigInt(value.slice(0, 12)) % 11n) % 10n === BigInt(value[12] ?? ''));

/** Checks an OGRNIP of an individual entrepreneur: 15 digits. */
export const validateOgrnip = (input: string): Validation =>
  check(input, 'OGRNIP', /^\d{15}$/, '15 digits', (value) => (BigInt(value.slice(0, 14)) % 13n) % 10n === BigInt(value[14] ?? ''));

/**
 * Checks a SNILS, with or without spaces and dashes: `112-233-445 95`.
 * Numbers up to 001-001-998 were issued before check digits existed and are accepted as is.
 */
export const validateSnils = (input: string): Validation =>
  check(input, 'SNILS', /^\d{11}$/, '11 digits', (value) => {
    if (Number(value.slice(0, 9)) <= 1_001_998) return true;
    const sum = weighted(value, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
    return (sum % 101) % 100 === Number(value.slice(9));
  });

const accountKey = (bik: string): string => (/^\d{6}00[012]$/.test(bik) ? `0${bik.slice(4, 6)}` : bik.slice(6));

/**
 * Checks the control key of a 20-digit account against the BIK of the bank where it is opened.
 * Treasury accounts (`03…`) are checked for format only, their key does not follow this scheme.
 *
 * @example
 * ```ts
 * validateAccount('40702810938000000001', '044525225'); // { valid: true, ... }
 * ```
 */
export const validateAccount = (account: string, bik: string): Validation => {
  const code = clean(bik);
  if (!/^\d{9}$/.test(code)) return fail('FORMAT', 'BIK must be 9 digits');
  return check(account, 'Account', /^\d{20}$/, '20 digits', (value) => value.startsWith('03') || weighted(accountKey(code) + value, ACCOUNT) % 10 === 0);
};

export const checkCorrespondentKey = (account: string, bik: string): Validation => {
  const code = clean(bik);
  if (!/^\d{9}$/.test(code)) return fail('FORMAT', 'BIK must be 9 digits');
  const result = check(account, 'Correspondent account', /^\d{20}$/, '20 digits', (value) => weighted(`0${code.slice(4, 6)}${value}`, ACCOUNT) % 10 === 0);
  if (result.valid && !result.value.startsWith('301')) return fail('FORMAT', 'Correspondent account must start with 301');
  return result;
};
