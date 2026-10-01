export type EntryAccount = readonly [account: string, type: string, active: 0 | 1, opened: string, closed: string];

export type EntryRestriction = readonly [code: string, date: string];

export type Entry = readonly [
  bik: string,
  name: string,
  englishName: string,
  participantType: string,
  registrationNumber: string,
  regionCode: string,
  postalCode: string,
  locality: string,
  address: string,
  since: string,
  parentBik: string,
  swift: string,
  accounts: readonly EntryAccount[],
  restrictions: readonly EntryRestriction[],
];
