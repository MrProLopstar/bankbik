/**
 * # bankbik
 *
 * The Bank of Russia BIK directory offline, plus checks for Russian requisites: INN, KPP, OGRN, OGRNIP, SNILS,
 * bank and correspondent accounts. No dependencies, no network requests.
 *
 * ```ts
 * import { bank, validateAccount, validateInn } from 'bankbik';
 *
 * bank('044525225')?.name;                              // 'ПАО Сбербанк'
 * validateAccount('40702810938000000001', '044525225'); // { valid: true, value: '40702810938000000001' }
 * validateInn('7707083894');                            // { valid: false, error: 'CHECKSUM', message: 'INN has a wrong check digit' }
 * ```
 *
 * Документация на русском: https://github.com/MrProLopstar/bankbik/blob/main/README.ru.md
 *
 * @module
 */
import { UPDATED } from './data.js';

export { bank, searchBanks, validateBik, validateCorrespondentAccount, type Account, type Bank, type ParticipantKind, type Restriction } from './bank.js';
export { validateAccount, validateInn, validateKpp, validateOgrn, validateOgrnip, validateSnils, type Validation, type ValidationError } from './validate.js';

/** Date of the bundled Bank of Russia directory, `YYYY-MM-DD`. */
export const updated: string = UPDATED;
