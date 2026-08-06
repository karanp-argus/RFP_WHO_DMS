/**
 * ISO 4217 currencies — the 143 distinct codes referenced by the country seed,
 * so every country resolves to a real currency record.
 *
 * `DEC_PLACES` matters: it drives value formatting in workbooks and reports, and
 * the zero-decimal currencies (JPY, KRW, CLP, VND, XAF/XOF, ISK, PYG, …) are
 * genuinely different, not a rounding preference. It is an xMart field —
 * see the Currency List screenshot in plan §1.3.
 *
 * `USD_RATE` is an indicative reference rate (units per US$). It is not an
 * xMart column — it is DMS-side seed data, needed because the per-capita US$
 * indicators in HLR8 divide by an exchange rate, and a workbook in JPY must read
 * in the millions where the same figure in GBP reads in the thousands.
 *
 * Format: ISO3|numeric|decimals|USD rate|symbol|symbolBefore|title
 */

import type { Currency } from '@/domain/types'

const RAW = `
AED|784|2|3.67|د.إ|1|UAE Dirham
AFN|971|2|71|؋|1|Afghan Afghani
ALL|8|2|93|L|0|Albanian Lek
AMD|51|2|388|֏|0|Armenian Dram
AOA|973|2|850|Kz|1|Angolan Kwanza
ARS|32|2|900|$|1|Argentine Peso
AUD|36|2|1.5|$|1|Australian Dollar
AZN|944|2|1.7|₼|1|Azerbaijani Manat
BAM|977|2|1.8|KM|0|Bosnia and Herzegovina Convertible Mark
BBD|52|2|2.0|$|1|Barbados Dollar
BDT|50|2|117|৳|1|Bangladeshi Taka
BGN|975|2|1.8|лв|0|Bulgarian Lev
BHD|48|3|0.376|.د.ب|1|Bahraini Dinar
BIF|108|0|2870|FBu|1|Burundian Franc
BND|96|2|1.34|$|1|Brunei Dollar
BOB|68|2|6.91|Bs|1|Bolivian Boliviano
BRL|986|2|5.4|R$|1|Brazilian Real
BSD|44|2|1.0|$|1|Bahamian Dollar
BTN|64|2|83|Nu.|1|Bhutanese Ngultrum
BWP|72|2|13.6|P|1|Botswana Pula
BYN|933|2|3.27|Br|1|Belarusian Ruble
BZD|84|2|2.0|$|1|Belize Dollar
CAD|124|2|1.36|$|1|Canadian Dollar
CDF|976|2|2800|FC|1|Congolese Franc
CHF|756|2|0.88|Fr|1|Swiss Franc
CLP|152|0|940|$|1|Chilean Peso
CNY|156|2|7.24|¥|1|Chinese Yuan Renminbi
COP|170|2|3950|$|1|Colombian Peso
CRC|188|2|520|₡|1|Costa Rican Colon
CUP|192|2|24|$|1|Cuban Peso
CVE|132|2|101|$|0|Cabo Verde Escudo
CZK|203|2|23.2|Kč|0|Czech Koruna
DJF|262|0|178|Fdj|1|Djiboutian Franc
DKK|208|2|6.86|kr|1|Danish Krone
DOP|214|2|59|$|1|Dominican Peso
DZD|12|2|134|د.ج|1|Algerian Dinar
EGP|818|2|48|£|1|Egyptian Pound
ERN|232|2|15|Nfk|1|Eritrean Nakfa
ETB|230|2|57|Br|1|Ethiopian Birr
EUR|978|2|0.92|€|1|Euro
FJD|242|2|2.25|$|1|Fiji Dollar
GBP|826|2|0.79|£|1|Pound Sterling
GEL|981|2|2.7|₾|1|Georgian Lari
GHS|936|2|15.2|₵|1|Ghanaian Cedi
GMD|270|2|68|D|1|Gambian Dalasi
GNF|324|0|8600|FG|1|Guinean Franc
GTQ|320|2|7.77|Q|1|Guatemalan Quetzal
GYD|328|2|209|$|1|Guyana Dollar
HNL|340|2|24.7|L|1|Honduran Lempira
HTG|332|2|132|G|1|Haitian Gourde
HUF|348|2|360|Ft|0|Hungarian Forint
IDR|360|2|16200|Rp|1|Indonesian Rupiah
ILS|376|2|3.7|₪|1|Israeli New Shekel
INR|356|2|83.4|₹|1|Indian Rupee
IQD|368|3|1310|ع.د|1|Iraqi Dinar
IRR|364|2|42000|﷼|1|Iranian Rial
ISK|352|0|138|kr|1|Iceland Krona
JMD|388|2|156|$|1|Jamaican Dollar
JOD|400|3|0.709|د.ا|1|Jordanian Dinar
JPY|392|0|157|¥|1|Japanese Yen
KES|404|2|129|KSh|1|Kenyan Shilling
KGS|417|2|87|с|0|Kyrgyzstani Som
KHR|116|2|4100|៛|0|Cambodian Riel
KMF|174|0|452|CF|1|Comorian Franc
KPW|408|2|900|₩|1|North Korean Won
KRW|410|0|1370|₩|1|South Korean Won
KWD|414|3|0.306|د.ك|1|Kuwaiti Dinar
KZT|398|2|470|₸|1|Kazakhstani Tenge
LAK|418|2|21500|₭|1|Lao Kip
LBP|422|2|89500|ل.ل|1|Lebanese Pound
LKR|144|2|300|Rs|1|Sri Lanka Rupee
LRD|430|2|194|$|1|Liberian Dollar
LSL|426|2|18.3|L|1|Lesotho Loti
LYD|434|3|4.85|ل.د|1|Libyan Dinar
MAD|504|2|9.9|د.م.|1|Moroccan Dirham
MDL|498|2|17.7|L|0|Moldovan Leu
MGA|969|2|4500|Ar|1|Malagasy Ariary
MKD|807|2|56.5|ден|0|Macedonian Denar
MMK|104|2|2100|K|1|Myanmar Kyat
MNT|496|2|3400|₮|1|Mongolian Tugrik
MRU|929|2|39.7|UM|0|Mauritanian Ouguiya
MUR|480|2|46.5|₨|1|Mauritian Rupee
MVR|462|2|15.4|Rf|1|Maldivian Rufiyaa
MWK|454|2|1735|MK|1|Malawi Kwacha
MXN|484|2|18.3|$|1|Mexican Peso
MYR|458|2|4.7|RM|1|Malaysian Ringgit
MZN|943|2|63.9|MT|1|Mozambique Metical
NAD|516|2|18.3|$|1|Namibia Dollar
NGN|566|2|1500|₦|1|Nigerian Naira
NIO|558|2|36.8|C$|1|Nicaraguan Cordoba Oro
NOK|578|2|10.6|kr|1|Norwegian Krone
NPR|524|2|133|₨|1|Nepalese Rupee
NZD|554|2|1.63|$|1|New Zealand Dollar
OMR|512|3|0.385|ر.ع.|1|Rial Omani
PAB|590|2|1.0|B/.|1|Panamanian Balboa
PEN|604|2|3.75|S/|1|Peruvian Sol
PGK|598|2|3.9|K|1|Papua New Guinean Kina
PHP|608|2|58|₱|1|Philippine Peso
PKR|586|2|278|₨|1|Pakistan Rupee
PLN|985|2|3.95|zł|0|Polish Zloty
PYG|600|0|7500|₲|1|Paraguayan Guarani
QAR|634|2|3.64|ر.ق|1|Qatari Rial
RON|946|2|4.58|lei|0|Romanian Leu
RSD|941|2|108|дин|0|Serbian Dinar
RUB|643|2|88|₽|0|Russian Ruble
RWF|646|0|1300|FRw|1|Rwanda Franc
SAR|682|2|3.75|ر.س|1|Saudi Riyal
SBD|90|2|8.45|$|1|Solomon Islands Dollar
SCR|690|2|13.6|₨|1|Seychelles Rupee
SDG|938|2|601|ج.س.|1|Sudanese Pound
SEK|752|2|10.5|kr|0|Swedish Krona
SGD|702|2|1.35|$|1|Singapore Dollar
SLE|925|2|22.5|Le|1|Sierra Leonean Leone
SOS|706|2|571|Sh|1|Somali Shilling
SRD|968|2|31|$|1|Surinam Dollar
SSP|728|2|1300|£|1|South Sudanese Pound
STN|930|2|22.6|Db|1|Sao Tome and Principe Dobra
SYP|760|2|13000|£|1|Syrian Pound
SZL|748|2|18.3|L|1|Swazi Lilangeni
THB|764|2|36.5|฿|1|Thai Baht
TJS|972|2|10.9|SM|0|Tajikistani Somoni
TMT|934|2|3.5|m|0|Turkmenistan New Manat
TND|788|3|3.12|د.ت|1|Tunisian Dinar
TOP|776|2|2.36|T$|1|Tongan Pa'anga
TRY|949|2|32.5|₺|1|Turkish Lira
TTD|780|2|6.78|$|1|Trinidad and Tobago Dollar
TZS|834|2|2600|TSh|1|Tanzanian Shilling
UAH|980|2|41|₴|1|Ukrainian Hryvnia
UGX|800|0|3750|USh|1|Uganda Shilling
USD|840|2|1.0|$|1|US Dollar
UYU|858|2|39|$|1|Uruguayan Peso
UZS|860|2|12600|so'm|0|Uzbekistan Sum
VES|928|2|36|Bs.|1|Venezuelan Bolivar Soberano
VND|704|0|25400|₫|0|Vietnamese Dong
VUV|548|0|119|VT|1|Vanuatu Vatu
WST|882|2|2.72|WS$|1|Samoan Tala
XAF|950|0|604|FCFA|1|CFA Franc BEAC
XCD|951|2|2.7|$|1|East Caribbean Dollar
XOF|952|0|604|CFA|1|CFA Franc BCEAO
YER|886|2|250|﷼|1|Yemeni Rial
ZAR|710|2|18.3|R|1|South African Rand
ZMW|967|2|26|ZK|1|Zambian Kwacha
ZWG|924|2|13.5|ZiG|1|Zimbabwe Gold
`.trim()

function expand(line: string): Currency & { USD_RATE: number } {
  const [code, num, dec, rate, symbol, before, title] = line.split('|')
  if (!code || !num || dec == null || !rate || !symbol || !before || !title) {
    throw new Error(`Malformed currency seed row: "${line}"`)
  }
  return {
    USD_RATE: Number(rate),
    CODE_ISO_3: code,
    TITLE: title,
    CODE_ISO_NUMERIC: Number(num),
    DESCRIPTION: title,
    SYMBOL: symbol,
    SYMBOL_BEFORE: before === '1',
    DEC_PLACES: Number(dec),
    TITLE_EN: title,
    // Non-English titles are out of scope for a prototype; the columns exist
    // because xMart has them and Setup displays them (plan §1.3).
    TITLE_FR: '',
    TITLE_ES: '',
    TITLE_AR: '',
    TITLE_RU: '',
    TITLE_ZH: '',
  }
}

export const CURRENCIES: readonly (Currency & { USD_RATE: number })[] = RAW.split('\n').map((l) =>
  expand(l.trim()),
)

export const CURRENCY_BY_CODE: ReadonlyMap<string, Currency & { USD_RATE: number }> = new Map(
  CURRENCIES.map((c) => [c.CODE_ISO_3, c]),
)

/** Attribute columns for the Setup → Currencies grid. */
export const CURRENCY_ATTRIBUTES = [
  { key: 'CODE_ISO_3', label: 'ISO3 Code', type: 'text', groupable: false, required: true, order: 0, isSystem: true },
  { key: 'TITLE', label: 'Title', type: 'text', groupable: false, required: true, order: 1, isSystem: true },
  { key: 'SYMBOL', label: 'Symbol', type: 'text', groupable: false, required: false, order: 2, isSystem: true },
  { key: 'DEC_PLACES', label: 'Decimal Places', type: 'number', groupable: false, required: false, order: 3, isSystem: true },
  { key: 'CODE_ISO_NUMERIC', label: 'ISO numeric', type: 'number', groupable: false, required: false, order: 4, isSystem: true },
  { key: 'SYMBOL_BEFORE', label: 'Symbol Before / After', type: 'boolean', groupable: false, required: false, order: 5, isSystem: true },
  { key: 'DESCRIPTION', label: 'Description', type: 'text', groupable: false, required: false, order: 6, isSystem: true },
] as const satisfies readonly import('@/domain/types').AttributeDef[]
