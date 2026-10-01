import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/data.js';
import {
  bank,
  searchBanks,
  updated,
  validateAccount,
  validateBik,
  validateCorrespondentAccount,
  validateInn,
  validateKpp,
  validateOgrn,
  validateOgrnip,
  validateSnils,
  type Validation,
} from '../src/index.js';

const errorOf = (result: Validation): string | null => (result.valid ? null : result.error);

const withCheckDigits = (body: string, digits: (value: string) => string): string => body + digits(body);
const random = (length: number): string => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

describe('known requisites', () => {
  it.each([
    [validateInn, '7707083893'],
    [validateInn, '500100732259'],
    [validateKpp, '773601001'],
    [validateKpp, '7736AB001'],
    [validateOgrn, '1027700132195'],
    [validateOgrnip, '304500116000157'],
    [validateSnils, '112-233-445 95'],
    [validateSnils, '001-001-998 00'],
  ] as const)('%o accepts %s', (validate, value) => {
    expect(validate(value).valid).toBe(true);
  });

  it.each([
    [validateInn, '7707083894', 'CHECKSUM'],
    [validateInn, '770708389', 'FORMAT'],
    [validateInn, '', 'EMPTY'],
    [validateInn, '50010073225x', 'FORMAT'],
    [validateKpp, '77360100', 'FORMAT'],
    [validateKpp, '7736ab001', 'FORMAT'],
    [validateOgrn, '1027700132196', 'CHECKSUM'],
    [validateOgrnip, '304500116000158', 'CHECKSUM'],
    [validateSnils, '112-233-445 96', 'CHECKSUM'],
  ] as const)('%o rejects %s with %s', (validate, value, code) => {
    expect(errorOf(validate(value))).toBe(code);
  });
});

describe('generated numbers', () => {
  const inn10 = (body: string): string => String(([2, 4, 10, 3, 5, 9, 4, 6, 8].reduce((sum, weight, index) => sum + weight * Number(body[index]), 0) % 11) % 10);
  const ogrn = (body: string): string => String((BigInt(body) % 11n) % 10n);
  const ogrnip = (body: string): string => String((BigInt(body) % 13n) % 10n);
  const wrongLast = (value: string): string => value.slice(0, -1) + String((Number(value.at(-1)) + 1 + Math.floor(Math.random() * 9)) % 10);

  it.each([
    ['INN', validateInn, () => withCheckDigits(random(9), inn10)],
    ['OGRN', validateOgrn, () => withCheckDigits(`1${random(11)}`, ogrn)],
    ['OGRNIP', validateOgrnip, () => withCheckDigits(`3${random(13)}`, ogrnip)],
  ] as const)('%s accepts the right check digit and rejects the other nine', (_, validate, make) => {
    for (let round = 0; round < 2000; round += 1) {
      const value = make();
      expect(validate(value).valid, value).toBe(true);
      expect(errorOf(validate(wrongLast(value))), value).toBe('CHECKSUM');
    }
  });
});

describe('accounts', () => {
  it('checks a settlement account against the bank BIK', () => {
    expect(validateAccount('40702810938000000001', '044525225').valid).toBe(true);
    expect(errorOf(validateAccount('40702810938000000002', '044525225'))).toBe('CHECKSUM');
    expect(errorOf(validateAccount('40702810938000000001', '044525974'))).toBe('CHECKSUM');
    expect(errorOf(validateAccount('4070281093800000000', '044525225'))).toBe('FORMAT');
    expect(errorOf(validateAccount('40702810938000000001', '04452522'))).toBe('FORMAT');
  });

  it('accepts every correspondent account in the directory', () => {
    let checked = 0;
    for (const [bik, , , , , , , , , , , , accounts] of ENTRIES) {
      for (const [account, type] of accounts) {
        if (type !== 'CRSA') continue;
        expect(validateCorrespondentAccount(account, bik), `${bik} ${account}`).toMatchObject({ valid: true });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('uses the Bank of Russia key for its own BIKs', () => {
    expect(validateAccount('40102810545370000003', '044525000').valid).toBe(true);
    expect(validateAccount('40102810545370000003', '004525988').valid).toBe(false);
  });

  it('reports a correspondent account of another bank', () => {
    expect(validateCorrespondentAccount('30101810400000000225', '044525225')).toEqual({ valid: true, value: '30101810400000000225' });
    expect(validateCorrespondentAccount('30101810145250000974', '044525225')).toMatchObject({ error: 'MISMATCH', message: 'ПАО Сбербанк has correspondent account 30101810400000000225' });
    expect(errorOf(validateCorrespondentAccount('40702810938000000001', '044525225'))).toBe('CHECKSUM');
  });
});

describe('directory', () => {
  it('finds banks by BIK', () => {
    expect(bank('044525225')).toMatchObject({ name: 'ПАО Сбербанк', kind: 'bank', swift: 'SABRRUMM', correspondentAccount: '30101810400000000225', locality: 'г Москва' });
    expect(bank(' 044525974 ')?.englishName).toBe('TBANK');
    expect(bank('000000000')).toBeNull();
  });

  it('classifies participants', () => {
    const kinds = new Set(ENTRIES.map(([bik]) => bank(bik)?.kind));
    expect(kinds).toContain('bank');
    expect(kinds).toContain('branch');
    expect(kinds).toContain('treasury');
    expect(kinds).toContain('central-bank');
    expect(kinds).toContain('liquidation');
  });

  it('searches by name, ignoring punctuation, and puts banks first', () => {
    expect(searchBanks('т-банк', 1)[0]?.bik).toBe('044525974');
    expect(searchBanks('сбер', 1)[0]?.bik).toBe('044525225');
    expect(searchBanks('SABRRUMM')[0]?.bik).toBe('044525225');
    expect(searchBanks('   ')).toEqual([]);
    expect(searchBanks('банк', 5)).toHaveLength(5);
  });

  it('validates BIKs against the directory', () => {
    expect(validateBik('044525225').valid).toBe(true);
    expect(errorOf(validateBik('000000000'))).toBe('UNKNOWN');
    expect(errorOf(validateBik('04452522'))).toBe('FORMAT');
  });

  it('has a unique, sorted directory', () => {
    const biks = ENTRIES.map(([bik]) => bik);
    expect(new Set(biks).size).toBe(biks.length);
    expect([...biks].sort()).toEqual(biks);
    expect(updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
