import * as lib from './lib/index.js';

const $ = (id) => document.getElementById(id);
const EXAMPLES = ['044525225', 'т-банк', 'альфа', 'SABRRUMM', 'втб'];
const KINDS = { bank: 'банк', branch: 'филиал', 'central-bank': 'Банк России', treasury: 'казначейство', liquidation: 'конкурсный управляющий', foreign: 'иностранный банк', other: 'другой участник' };
const CHECKS = {
  inn: ['7707083893', (value) => lib.validateInn(value)],
  kpp: ['773601001', (value) => lib.validateKpp(value)],
  ogrn: ['1027700132195', (value) => lib.validateOgrn(value)],
  ogrnip: ['304500116000157', (value) => lib.validateOgrnip(value)],
  snils: ['112-233-445 95', (value) => lib.validateSnils(value)],
  account: ['40702810938000000001', (value, bik) => lib.validateAccount(value, bik)],
  corr: ['30101810400000000225', (value, bik) => lib.validateCorrespondentAccount(value, bik)],
};
const ERRORS = { EMPTY: 'Пусто', FORMAT: 'Неверный формат', CHECKSUM: 'Не сходится контрольная цифра', UNKNOWN: 'Нет в справочнике', MISMATCH: 'Не совпадает со справочником' };

const field = (name, value) => (value ? `<dt>${name}</dt><dd>${value.replace(/</g, '&lt;')}</dd>` : '');

const showBank = (bank) => {
  $('bank').hidden = !bank;
  if (!bank) return;
  $('bank-name').textContent = bank.name;
  $('bank-bik').textContent = `БИК ${bank.bik}`;
  $('bank-fields').innerHTML = [
    field('Тип', KINDS[bank.kind]),
    field('Корсчёт', bank.correspondentAccount),
    field('SWIFT', bank.swift),
    field('Английское', bank.englishName),
    field('Рег. номер', bank.registrationNumber),
    field('Адрес', [bank.postalCode, bank.locality, bank.address].filter(Boolean).join(', ')),
    field('Ограничения', bank.restrictions.map((item) => `${item.code} с ${item.date}`).join(', ')),
  ].join('');
};

const search = () => {
  const query = $('query').value;
  const exact = lib.bank(query.replace(/\s/g, ''));
  const found = exact ? [] : lib.searchBanks(query, 8);
  showBank(exact ?? (found.length === 1 ? found[0] : null));
  $('list').innerHTML = '';
  if (exact || found.length === 1) return;
  for (const bank of found) {
    const item = document.createElement('li');
    item.innerHTML = `<b></b><br><small></small>`;
    item.querySelector('b').textContent = bank.name;
    item.querySelector('small').textContent = `${bank.bik} · ${KINDS[bank.kind]}`;
    item.addEventListener('click', () => {
      $('query').value = bank.bik;
      search();
    });
    $('list').append(item);
  }
};

const verify = () => {
  const [, check] = CHECKS[$('kind').value];
  const value = $('value').value;
  if (!value.trim()) return void ($('verdict').hidden = true);
  const result = check(value, $('bik').value);
  $('verdict').hidden = false;
  $('verdict').className = `verdict ${result.valid ? 'ok' : 'bad'}`;
  $('verdict').textContent = result.valid ? `Верно: ${result.value}` : `${ERRORS[result.error]}. ${result.message}`;
};

$('kind').addEventListener('change', () => {
  const [example] = CHECKS[$('kind').value];
  $('value').value = example;
  $('value').placeholder = example;
  $('bik').hidden = !['account', 'corr'].includes($('kind').value);
  if (!$('bik').value) $('bik').value = '044525225';
  verify();
});

for (const example of EXAMPLES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = example;
  button.addEventListener('click', () => {
    $('query').value = example;
    search();
  });
  $('examples').append(button);
}

$('query').addEventListener('input', search);
$('value').addEventListener('input', verify);
$('bik').addEventListener('input', verify);
$('query').value = EXAMPLES[0];
$('value').value = CHECKS.inn[0];
$('note').textContent = `Справочник Банка России от ${lib.updated}.`;
search();
verify();
