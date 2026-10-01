# bankbik

[![npm](https://img.shields.io/npm/v/bankbik?color=0e7c66&cacheSeconds=3600)](https://www.npmjs.com/package/bankbik)
[![JSR](https://jsr.io/badges/@mrprolopstar/bankbik?v=1)](https://jsr.io/@mrprolopstar/bankbik)

[Русская версия](README.ru.md) · [Playground](https://mrprolopstar.github.io/bankbik/)

The Bank of Russia BIK directory offline, plus checks for Russian requisites: INN, KPP, OGRN, OGRNIP, SNILS, settlement and correspondent accounts. The directory is bundled into the package (about 80 KB gzipped) and republished automatically when the Bank of Russia changes it. No dependencies, no network requests.

```sh
npm install bankbik
```

```ts
import { bank, searchBanks, validateAccount, validateInn } from 'bankbik';

bank('044525225');
// {
//   bik: '044525225', name: 'ПАО Сбербанк', englishName: 'SBERBANK', kind: 'bank',
//   swift: 'SABRRUMM', correspondentAccount: '30101810400000000225',
//   locality: 'г Москва', address: 'улица Вавилова, дом 19', restrictions: [], ...
// }

searchBanks('т-банк', 1)[0]?.bik;                      // '044525974'

validateAccount('40702810938000000001', '044525225');  // { valid: true, value: '40702810938000000001' }
validateInn('7707083894');                             // { valid: false, error: 'CHECKSUM', message: 'INN has a wrong check digit' }
```

## Directory

| Function | Result |
|---|---|
| `bank(bik)` | `Bank` or `null` |
| `searchBanks(query, limit = 20)` | Banks whose name, English name, BIK or SWIFT contains the query; punctuation and case are ignored, banks go before branches |
| `validateBik(bik)` | Format and presence in the directory |
| `updated` | Date of the bundled directory |

`Bank.kind` is one of `bank`, `branch`, `central-bank`, `treasury`, `liquidation` (receivers of banks in bankruptcy), `foreign` and `other`; the raw participant type code is in `participantType`. `restrictions` lists the Bank of Russia restriction codes with dates, for example `URRS` for restricted payment services.

## Requisites

Every check returns `{ valid: true, value }` with the cleaned value (spaces and dashes removed) or `{ valid: false, error, message }`, where `error` is `EMPTY`, `FORMAT`, `CHECKSUM`, `UNKNOWN` or `MISMATCH`.

| Function | Checks |
|---|---|
| `validateInn(value)` | 10 or 12 digits and check digits |
| `validateKpp(value)` | Format, KPP has no check digit |
| `validateOgrn(value)` | 13 digits and check digit |
| `validateOgrnip(value)` | 15 digits and check digit |
| `validateSnils(value)` | 11 digits and check number; numbers up to 001-001-998 predate check numbers and are accepted |
| `validateAccount(account, bik)` | Control key of a 20-digit account for the bank with this BIK |
| `validateCorrespondentAccount(account, bik)` | Control key and that the directory lists this account for the BIK |

Treasury accounts (`03…`) are checked for format only: their key does not follow the bank account scheme.

## Data

The directory is the Bank of Russia ED807 file from [cbr.ru](https://www.cbr.ru/PSystem/payment_system/). Every Monday GitHub Actions downloads it, checks it (at least 1000 participants, Sberbank and its correspondent account present), and if anything changed runs the tests, including the control key of every correspondent account in the directory, and publishes a new minor version.

## License

MIT
