# bankbik

[![npm](https://img.shields.io/npm/v/bankbik?color=0e7c66&cacheSeconds=3600)](https://www.npmjs.com/package/bankbik)
[![JSR](https://jsr.io/badges/@mrprolopstar/bankbik?v=1)](https://jsr.io/@mrprolopstar/bankbik)

[English version](README.md) · [Песочница](https://mrprolopstar.github.io/bankbik/)

Справочник БИК Банка России офлайн и проверка реквизитов: ИНН, КПП, ОГРН, ОГРНИП, СНИЛС, расчётные и корреспондентские счета. Справочник лежит внутри пакета (около 80 КБ в gzip) и сам переиздаётся, когда Банк России его меняет. Без зависимостей и сетевых запросов.

```sh
npm install bankbik
```

Без сборщика пакет можно подключить в браузере прямо с jsDelivr: он сам собирает минифицированный ES-модуль из npm-пакета:

```html
<script type="module">
  import { bank } from 'https://cdn.jsdelivr.net/npm/bankbik@0/+esm';
  console.log(bank('044525225'));
</script>
```

`@0` берёт последний релиз 0.x; в продакшене лучше указать точную версию, например `@0.1.0`.

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

## Справочник

| Функция | Результат |
|---|---|
| `bank(bik)` | `Bank` или `null` |
| `searchBanks(query, limit = 20)` | Банки, у которых название, английское название, БИК или SWIFT содержат запрос; регистр и знаки препинания не важны, банки идут раньше филиалов |
| `validateBik(bik)` | Формат и наличие в справочнике |
| `updated` | Дата справочника в пакете |

`Bank.kind` принимает значения `bank`, `branch`, `central-bank`, `treasury`, `liquidation` (конкурсные управляющие банков-банкротов), `foreign` и `other`; исходный код типа участника лежит в `participantType`. В `restrictions` перечислены коды ограничений Банка России с датами, например `URRS`, ограничение услуг по переводу средств.

## Реквизиты

Каждая проверка возвращает `{ valid: true, value }` с очищенным значением (без пробелов и дефисов) или `{ valid: false, error, message }`, где `error` равен `EMPTY`, `FORMAT`, `CHECKSUM`, `UNKNOWN` или `MISMATCH`.

| Функция | Что проверяет |
|---|---|
| `validateInn(value)` | 10 или 12 цифр и контрольные цифры |
| `validateKpp(value)` | Формат, контрольной цифры у КПП нет |
| `validateOgrn(value)` | 13 цифр и контрольную цифру |
| `validateOgrnip(value)` | 15 цифр и контрольную цифру |
| `validateSnils(value)` | 11 цифр и контрольное число; номера до 001-001-998 выданы до появления контрольного числа и принимаются |
| `validateAccount(account, bik)` | Контрольный ключ 20-значного счёта в банке с этим БИК |
| `validateCorrespondentAccount(account, bik)` | Контрольный ключ и то, что в справочнике у этого БИК именно такой корсчёт |

Казначейские счета (`03…`) проверяются только по формату: их ключ считается не по схеме банковских счетов.

## Данные

Справочник берётся из файла ED807 Банка России с [cbr.ru](https://www.cbr.ru/PSystem/payment_system/). Каждый понедельник GitHub Actions скачивает его и проверяет: участников не меньше 1000, Сбербанк и его корсчёт на месте. Если что-то изменилось, запускаются тесты, в том числе проверка ключа у каждого корсчёта из справочника, и выходит новая минорная версия.

## Лицензия

MIT
