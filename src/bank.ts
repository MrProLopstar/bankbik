import { ENTRIES } from './data.js';
import type { Entry } from './entry.js';
import { checkCorrespondentKey, type Validation } from './validate.js';

export type ParticipantKind = 'bank' | 'branch' | 'central-bank' | 'treasury' | 'liquidation' | 'foreign' | 'other';

export interface Account {
  readonly number: string;
  readonly type: string;
  readonly active: boolean;
  readonly opened: string;
  readonly closed: string | null;
}

export interface Restriction {
  readonly code: string;
  readonly date: string;
}

export interface Bank {
  readonly bik: string;
  readonly name: string;
  readonly englishName: string | null;
  readonly kind: ParticipantKind;
  readonly participantType: string;
  readonly registrationNumber: string | null;
  readonly regionCode: string;
  readonly postalCode: string | null;
  readonly locality: string | null;
  readonly address: string | null;
  readonly since: string;
  readonly parentBik: string | null;
  readonly swift: string | null;
  readonly correspondentAccount: string | null;
  readonly accounts: readonly Account[];
  readonly restrictions: readonly Restriction[];
}

const KINDS: Readonly<Record<string, ParticipantKind>> = {
  '00': 'central-bank',
  '10': 'central-bank',
  '12': 'central-bank',
  '15': 'central-bank',
  '16': 'central-bank',
  '40': 'central-bank',
  '20': 'bank',
  '30': 'branch',
  '51': 'treasury',
  '52': 'treasury',
  '90': 'liquidation',
  '60': 'foreign',
  '65': 'foreign',
};

const toBank = ([bik, name, englishName, participantType, registrationNumber, regionCode, postalCode, locality, address, since, parentBik, swift, accounts, restrictions]: Entry): Bank => {
  const list = accounts.map(([number, type, active, opened, closed]) => ({ number, type, active: active === 1, opened, closed: closed || null }));
  return {
    bik,
    name,
    englishName: englishName || null,
    kind: KINDS[participantType] ?? 'other',
    participantType,
    registrationNumber: registrationNumber || null,
    regionCode,
    postalCode: postalCode || null,
    locality: locality || null,
    address: address || null,
    since,
    parentBik: parentBik || null,
    swift: swift || null,
    correspondentAccount: list.find((account) => account.type === 'CRSA' && account.active)?.number ?? null,
    accounts: list,
    restrictions: restrictions.map(([code, date]) => ({ code, date })),
  };
};

const normalize = (text: string): string => text.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/g, '').replace(/\s+/g, ' ').trim();

let index: ReadonlyMap<string, Entry> | null = null;

/**
 * Looks up a bank or another payment system participant by BIK. Returns `null` if the BIK is not in the directory.
 *
 * @example
 * ```ts
 * bank('044525225')?.name;                 // 'ПАО Сбербанк'
 * bank('044525225')?.correspondentAccount; // '30101810400000000225'
 * ```
 */
export const bank = (bik: string): Bank | null => {
  index ??= new Map(ENTRIES.map((entry) => [entry[0], entry]));
  const entry = index.get(bik.trim());
  return entry ? toBank(entry) : null;
};

/**
 * Finds participants whose name, English name, BIK or SWIFT contains the query, ignoring case, spaces and punctuation.
 *
 * @example
 * ```ts
 * searchBanks('сбербанк', 5).map((bank) => bank.bik);
 * ```
 */
export const searchBanks = (query: string, limit = 20): Bank[] => {
  const needle = normalize(query);
  if (!needle) return [];
  const score = (entry: Entry): number => {
    const fields = [entry[0], entry[1], entry[2], entry[11]].map(normalize);
    if (!fields.some((field) => field.includes(needle))) return -1;
    const word = fields.some((field) => ` ${field}`.includes(` ${needle}`)) ? 2 : 0;
    return word + (entry[3] === '20' ? 1 : 0);
  };
  return ENTRIES.map((entry) => [score(entry), entry] as const)
    .filter(([value]) => value >= 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, entry]) => toBank(entry));
};

/**
 * Checks that a BIK has 9 digits and is present in the directory.
 */
export const validateBik = (input: string): Validation => {
  const value = input.replace(/[\s-]/g, '');
  if (!value) return { valid: false, error: 'EMPTY', message: 'BIK is empty' };
  if (!/^\d{9}$/.test(value)) return { valid: false, error: 'FORMAT', message: 'BIK must be 9 digits' };
  return bank(value) ? { valid: true, value } : { valid: false, error: 'UNKNOWN', message: `BIK ${value} is not in the Bank of Russia directory` };
};

/**
 * Checks a bank's correspondent account (`301…`): its control key against the bank's BIK and, when the BIK is in
 * the directory, that this is the account listed for it.
 *
 * @example
 * ```ts
 * validateCorrespondentAccount('30101810400000000225', '044525225'); // { valid: true, ... }
 * ```
 */
export const validateCorrespondentAccount = (account: string, bik: string): Validation => {
  const result = checkCorrespondentKey(account, bik);
  if (!result.valid) return result;
  const known = bank(bik.replace(/[\s-]/g, ''));
  if (known && !known.accounts.some((item) => item.number === result.value)) {
    return { valid: false, error: 'MISMATCH', message: `${known.name} has correspondent account ${known.correspondentAccount ?? 'none'}` };
  }
  return result;
};
