/**
 * WHO Member States.
 *
 * Real ISO 3166 codes, real WHO regional assignments, real World Bank income
 * groups and real currency codes — the RFP says "196 countries" and evaluators
 * from the HA team will recognise wrong data instantly, so nothing here is
 * faked. Populations are rounded to the nearest thousand and are indicative.
 *
 * Focal point names ARE fictional, deliberately: the RFP names real WHO staff
 * in its distribution list and it would be inappropriate to seed them as demo
 * records. They are generated in `expand()` below from a fixed fictional pool.
 *
 * Format: ISO3|ISO2|numeric|WHO region|WB income|OECD|currency|population(000s)|short name|capital
 */

import type { WbIncome, WhoRegion } from '@/domain/constants'
import type { Country } from '@/domain/types'
import { pick } from '../generators/seedRandom'

const RAW = `
AFG|AF|4|EMR|LIC|0|AFN|42240|Afghanistan|Kabul
ALB|AL|8|EUR|UMC|0|ALL|2746|Albania|Tirana
DZA|DZ|12|AFR|LMC|0|DZD|45606|Algeria|Algiers
AND|AD|20|EUR|HIC|0|EUR|80|Andorra|Andorra la Vella
AGO|AO|24|AFR|LMC|0|AOA|36684|Angola|Luanda
ATG|AG|28|AMR|HIC|0|XCD|94|Antigua and Barbuda|Saint John's
ARG|AR|32|AMR|UMC|0|ARS|46654|Argentina|Buenos Aires
ARM|AM|51|EUR|UMC|0|AMD|2777|Armenia|Yerevan
AUS|AU|36|WPR|HIC|1|AUD|26439|Australia|Canberra
AUT|AT|40|EUR|HIC|1|EUR|9042|Austria|Vienna
AZE|AZ|31|EUR|UMC|0|AZN|10413|Azerbaijan|Baku
BHS|BS|44|AMR|HIC|0|BSD|412|Bahamas|Nassau
BHR|BH|48|EMR|HIC|0|BHD|1485|Bahrain|Manama
BGD|BD|50|SEAR|LMC|0|BDT|172954|Bangladesh|Dhaka
BRB|BB|52|AMR|HIC|0|BBD|282|Barbados|Bridgetown
BLR|BY|112|EUR|UMC|0|BYN|9498|Belarus|Minsk
BEL|BE|56|EUR|HIC|1|EUR|11686|Belgium|Brussels
BLZ|BZ|84|AMR|UMC|0|BZD|410|Belize|Belmopan
BEN|BJ|204|AFR|LMC|0|XOF|13712|Benin|Porto-Novo
BTN|BT|64|SEAR|LMC|0|BTN|787|Bhutan|Thimphu
BOL|BO|68|AMR|LMC|0|BOB|12389|Bolivia (Plurinational State of)|Sucre
BIH|BA|70|EUR|UMC|0|BAM|3210|Bosnia and Herzegovina|Sarajevo
BWA|BW|72|AFR|UMC|0|BWP|2675|Botswana|Gaborone
BRA|BR|76|AMR|UMC|0|BRL|216422|Brazil|Brasilia
BRN|BN|96|WPR|HIC|0|BND|449|Brunei Darussalam|Bandar Seri Begawan
BGR|BG|100|EUR|UMC|0|BGN|6688|Bulgaria|Sofia
BFA|BF|854|AFR|LIC|0|XOF|22673|Burkina Faso|Ouagadougou
BDI|BI|108|AFR|LIC|0|BIF|13238|Burundi|Gitega
CPV|CV|132|AFR|LMC|0|CVE|598|Cabo Verde|Praia
KHM|KH|116|WPR|LMC|0|KHR|16944|Cambodia|Phnom Penh
CMR|CM|120|AFR|LMC|0|XAF|28647|Cameroon|Yaounde
CAN|CA|124|AMR|HIC|1|CAD|38781|Canada|Ottawa
CAF|CF|140|AFR|LIC|0|XAF|5742|Central African Republic|Bangui
TCD|TD|148|AFR|LIC|0|XAF|18278|Chad|N'Djamena
CHL|CL|152|AMR|HIC|1|CLP|19629|Chile|Santiago
CHN|CN|156|WPR|UMC|0|CNY|1425671|China|Beijing
COL|CO|170|AMR|UMC|1|COP|52085|Colombia|Bogota
COM|KM|174|AFR|LMC|0|KMF|852|Comoros|Moroni
COG|CG|178|AFR|LMC|0|XAF|6106|Congo|Brazzaville
COK|CK|184|WPR|UMC|0|NZD|17|Cook Islands|Avarua
CRI|CR|188|AMR|UMC|1|CRC|5106|Costa Rica|San Jose
CIV|CI|384|AFR|LMC|0|XOF|28160|Cote d'Ivoire|Yamoussoukro
HRV|HR|191|EUR|HIC|0|EUR|4008|Croatia|Zagreb
CUB|CU|192|AMR|UMC|0|CUP|11194|Cuba|Havana
CYP|CY|196|EUR|HIC|0|EUR|1260|Cyprus|Nicosia
CZE|CZ|203|EUR|HIC|1|CZK|10495|Czechia|Prague
PRK|KP|408|SEAR|LIC|0|KPW|26161|Democratic People's Republic of Korea|Pyongyang
COD|CD|180|AFR|LIC|0|CDF|102262|Democratic Republic of the Congo|Kinshasa
DNK|DK|208|EUR|HIC|1|DKK|5910|Denmark|Copenhagen
DJI|DJ|262|EMR|LMC|0|DJF|1136|Djibouti|Djibouti
DMA|DM|212|AMR|UMC|0|XCD|73|Dominica|Roseau
DOM|DO|214|AMR|UMC|0|DOP|11333|Dominican Republic|Santo Domingo
ECU|EC|218|AMR|UMC|0|USD|18190|Ecuador|Quito
EGY|EG|818|EMR|LMC|0|EGP|112717|Egypt|Cairo
SLV|SV|222|AMR|LMC|0|USD|6364|El Salvador|San Salvador
GNQ|GQ|226|AFR|UMC|0|XAF|1714|Equatorial Guinea|Malabo
ERI|ER|232|AFR|LIC|0|ERN|3749|Eritrea|Asmara
EST|EE|233|EUR|HIC|1|EUR|1323|Estonia|Tallinn
SWZ|SZ|748|AFR|LMC|0|SZL|1210|Eswatini|Mbabane
ETH|ET|231|AFR|LIC|0|ETB|126527|Ethiopia|Addis Ababa
FJI|FJ|242|WPR|UMC|0|FJD|936|Fiji|Suva
FIN|FI|246|EUR|HIC|1|EUR|5545|Finland|Helsinki
FRA|FR|250|EUR|HIC|1|EUR|64757|France|Paris
GAB|GA|266|AFR|UMC|0|XAF|2437|Gabon|Libreville
GMB|GM|270|AFR|LIC|0|GMD|2773|Gambia|Banjul
GEO|GE|268|EUR|UMC|0|GEL|3728|Georgia|Tbilisi
DEU|DE|276|EUR|HIC|1|EUR|83295|Germany|Berlin
GHA|GH|288|AFR|LMC|0|GHS|34122|Ghana|Accra
GRC|GR|300|EUR|HIC|1|EUR|10341|Greece|Athens
GRD|GD|308|AMR|UMC|0|XCD|126|Grenada|Saint George's
GTM|GT|320|AMR|UMC|0|GTQ|18092|Guatemala|Guatemala City
GIN|GN|324|AFR|LMC|0|GNF|14190|Guinea|Conakry
GNB|GW|624|AFR|LIC|0|XOF|2153|Guinea-Bissau|Bissau
GUY|GY|328|AMR|HIC|0|GYD|814|Guyana|Georgetown
HTI|HT|332|AMR|LIC|0|HTG|11725|Haiti|Port-au-Prince
HND|HN|340|AMR|LMC|0|HNL|10593|Honduras|Tegucigalpa
HUN|HU|348|EUR|HIC|1|HUF|10156|Hungary|Budapest
ISL|IS|352|EUR|HIC|1|ISK|376|Iceland|Reykjavik
IND|IN|356|SEAR|LMC|0|INR|1428628|India|New Delhi
IDN|ID|360|SEAR|UMC|0|IDR|277534|Indonesia|Jakarta
IRN|IR|364|EMR|LMC|0|IRR|89173|Iran (Islamic Republic of)|Tehran
IRQ|IQ|368|EMR|UMC|0|IQD|45505|Iraq|Baghdad
IRL|IE|372|EUR|HIC|1|EUR|5056|Ireland|Dublin
ISR|IL|376|EUR|HIC|1|ILS|9174|Israel|Jerusalem
ITA|IT|380|EUR|HIC|1|EUR|58870|Italy|Rome
JAM|JM|388|AMR|UMC|0|JMD|2826|Jamaica|Kingston
JPN|JP|392|WPR|HIC|1|JPY|123295|Japan|Tokyo
JOR|JO|400|EMR|LMC|0|JOD|11337|Jordan|Amman
KAZ|KZ|398|EUR|UMC|0|KZT|19606|Kazakhstan|Astana
KEN|KE|404|AFR|LMC|0|KES|55100|Kenya|Nairobi
KIR|KI|296|WPR|LMC|0|AUD|134|Kiribati|Tarawa
KWT|KW|414|EMR|HIC|0|KWD|4310|Kuwait|Kuwait City
KGZ|KG|417|EUR|LMC|0|KGS|6735|Kyrgyzstan|Bishkek
LAO|LA|418|WPR|LMC|0|LAK|7633|Lao People's Democratic Republic|Vientiane
LVA|LV|428|EUR|HIC|1|EUR|1830|Latvia|Riga
LBN|LB|422|EMR|LMC|0|LBP|5354|Lebanon|Beirut
LSO|LS|426|AFR|LMC|0|LSL|2306|Lesotho|Maseru
LBR|LR|430|AFR|LIC|0|LRD|5418|Liberia|Monrovia
LBY|LY|434|EMR|UMC|0|LYD|6888|Libya|Tripoli
LTU|LT|440|EUR|HIC|1|EUR|2718|Lithuania|Vilnius
LUX|LU|442|EUR|HIC|1|EUR|654|Luxembourg|Luxembourg
MDG|MG|450|AFR|LIC|0|MGA|30325|Madagascar|Antananarivo
MWI|MW|454|AFR|LIC|0|MWK|20932|Malawi|Lilongwe
MYS|MY|458|WPR|UMC|0|MYR|34309|Malaysia|Kuala Lumpur
MDV|MV|462|SEAR|UMC|0|MVR|521|Maldives|Male
MLI|ML|466|AFR|LIC|0|XOF|23294|Mali|Bamako
MLT|MT|470|EUR|HIC|0|EUR|535|Malta|Valletta
MHL|MH|584|WPR|UMC|0|USD|42|Marshall Islands|Majuro
MRT|MR|478|AFR|LMC|0|MRU|4863|Mauritania|Nouakchott
MUS|MU|480|AFR|UMC|0|MUR|1301|Mauritius|Port Louis
MEX|MX|484|AMR|UMC|1|MXN|128456|Mexico|Mexico City
FSM|FM|583|WPR|LMC|0|USD|115|Micronesia (Federated States of)|Palikir
MCO|MC|492|EUR|HIC|0|EUR|36|Monaco|Monaco
MNG|MN|496|WPR|LMC|0|MNT|3447|Mongolia|Ulaanbaatar
MNE|ME|499|EUR|UMC|0|EUR|627|Montenegro|Podgorica
MAR|MA|504|EMR|LMC|0|MAD|37840|Morocco|Rabat
MOZ|MZ|508|AFR|LIC|0|MZN|33897|Mozambique|Maputo
MMR|MM|104|SEAR|LMC|0|MMK|54578|Myanmar|Nay Pyi Taw
NAM|NA|516|AFR|UMC|0|NAD|2604|Namibia|Windhoek
NRU|NR|520|WPR|HIC|0|AUD|13|Nauru|Yaren
NPL|NP|524|SEAR|LMC|0|NPR|30897|Nepal|Kathmandu
NLD|NL|528|EUR|HIC|1|EUR|17618|Netherlands (Kingdom of the)|Amsterdam
NZL|NZ|554|WPR|HIC|1|NZD|5228|New Zealand|Wellington
NIC|NI|558|AMR|LMC|0|NIO|7046|Nicaragua|Managua
NER|NE|562|AFR|LIC|0|XOF|27203|Niger|Niamey
NGA|NG|566|AFR|LMC|0|NGN|223804|Nigeria|Abuja
NIU|NU|570|WPR|UMC|0|NZD|2|Niue|Alofi
MKD|MK|807|EUR|UMC|0|MKD|2085|North Macedonia|Skopje
NOR|NO|578|EUR|HIC|1|NOK|5474|Norway|Oslo
OMN|OM|512|EMR|HIC|0|OMR|4644|Oman|Muscat
PAK|PK|586|EMR|LMC|0|PKR|240486|Pakistan|Islamabad
PLW|PW|585|WPR|HIC|0|USD|18|Palau|Ngerulmud
PAN|PA|591|AMR|HIC|0|PAB|4468|Panama|Panama City
PNG|PG|598|WPR|LMC|0|PGK|10329|Papua New Guinea|Port Moresby
PRY|PY|600|AMR|UMC|0|PYG|6862|Paraguay|Asuncion
PER|PE|604|AMR|UMC|0|PEN|34353|Peru|Lima
PHL|PH|608|WPR|LMC|0|PHP|117337|Philippines|Manila
POL|PL|616|EUR|HIC|1|PLN|41026|Poland|Warsaw
PRT|PT|620|EUR|HIC|1|EUR|10247|Portugal|Lisbon
QAT|QA|634|EMR|HIC|0|QAR|2716|Qatar|Doha
KOR|KR|410|WPR|HIC|1|KRW|51785|Republic of Korea|Seoul
MDA|MD|498|EUR|UMC|0|MDL|3436|Republic of Moldova|Chisinau
ROU|RO|642|EUR|HIC|0|RON|19893|Romania|Bucharest
RUS|RU|643|EUR|UMC|0|RUB|144444|Russian Federation|Moscow
RWA|RW|646|AFR|LIC|0|RWF|14095|Rwanda|Kigali
KNA|KN|659|AMR|HIC|0|XCD|48|Saint Kitts and Nevis|Basseterre
LCA|LC|662|AMR|UMC|0|XCD|180|Saint Lucia|Castries
VCT|VC|670|AMR|UMC|0|XCD|104|Saint Vincent and the Grenadines|Kingstown
WSM|WS|882|WPR|LMC|0|WST|226|Samoa|Apia
SMR|SM|674|EUR|HIC|0|EUR|34|San Marino|San Marino
STP|ST|678|AFR|LMC|0|STN|231|Sao Tome and Principe|Sao Tome
SAU|SA|682|EMR|HIC|0|SAR|36947|Saudi Arabia|Riyadh
SEN|SN|686|AFR|LMC|0|XOF|17763|Senegal|Dakar
SRB|RS|688|EUR|UMC|0|RSD|7150|Serbia|Belgrade
SYC|SC|690|AFR|HIC|0|SCR|108|Seychelles|Victoria
SLE|SL|694|AFR|LIC|0|SLE|8791|Sierra Leone|Freetown
SGP|SG|702|WPR|HIC|0|SGD|6015|Singapore|Singapore
SVK|SK|703|EUR|HIC|1|EUR|5795|Slovakia|Bratislava
SVN|SI|705|EUR|HIC|1|EUR|2120|Slovenia|Ljubljana
SLB|SB|90|WPR|LMC|0|SBD|741|Solomon Islands|Honiara
SOM|SO|706|EMR|LIC|0|SOS|18143|Somalia|Mogadishu
ZAF|ZA|710|AFR|UMC|0|ZAR|60414|South Africa|Pretoria
SSD|SS|728|AFR|LIC|0|SSP|11088|South Sudan|Juba
ESP|ES|724|EUR|HIC|1|EUR|47519|Spain|Madrid
LKA|LK|144|SEAR|LMC|0|LKR|21894|Sri Lanka|Colombo
SDN|SD|729|EMR|LIC|0|SDG|48109|Sudan|Khartoum
SUR|SR|740|AMR|UMC|0|SRD|623|Suriname|Paramaribo
SWE|SE|752|EUR|HIC|1|SEK|10613|Sweden|Stockholm
CHE|CH|756|EUR|HIC|1|CHF|8797|Switzerland|Bern
SYR|SY|760|EMR|LIC|0|SYP|23227|Syrian Arab Republic|Damascus
TJK|TJ|762|EUR|LMC|0|TJS|10143|Tajikistan|Dushanbe
THA|TH|764|SEAR|UMC|0|THB|71801|Thailand|Bangkok
TLS|TL|626|SEAR|LMC|0|USD|1361|Timor-Leste|Dili
TGO|TG|768|AFR|LIC|0|XOF|9054|Togo|Lome
TON|TO|776|WPR|UMC|0|TOP|107|Tonga|Nuku'alofa
TTO|TT|780|AMR|HIC|0|TTD|1535|Trinidad and Tobago|Port of Spain
TUN|TN|788|EMR|LMC|0|TND|12458|Tunisia|Tunis
TUR|TR|792|EUR|UMC|1|TRY|85326|Turkiye|Ankara
TKM|TM|795|EUR|UMC|0|TMT|6516|Turkmenistan|Ashgabat
TUV|TV|798|WPR|UMC|0|AUD|11|Tuvalu|Funafuti
UGA|UG|800|AFR|LIC|0|UGX|48582|Uganda|Kampala
UKR|UA|804|EUR|LMC|0|UAH|36745|Ukraine|Kyiv
ARE|AE|784|EMR|HIC|0|AED|9516|United Arab Emirates|Abu Dhabi
GBR|GB|826|EUR|HIC|1|GBP|67736|United Kingdom of Great Britain and Northern Ireland|London
TZA|TZ|834|AFR|LMC|0|TZS|67438|United Republic of Tanzania|Dodoma
USA|US|840|AMR|HIC|1|USD|339997|United States of America|Washington DC
URY|UY|858|AMR|HIC|0|UYU|3423|Uruguay|Montevideo
UZB|UZ|860|EUR|LMC|0|UZS|35164|Uzbekistan|Tashkent
VUT|VU|548|WPR|LMC|0|VUV|335|Vanuatu|Port Vila
VEN|VE|862|AMR|UMC|0|VES|28839|Venezuela (Bolivarian Republic of)|Caracas
VNM|VN|704|WPR|LMC|0|VND|98859|Viet Nam|Hanoi
YEM|YE|887|EMR|LIC|0|YER|34449|Yemen|Sanaa
ZMB|ZM|894|AFR|LMC|0|ZMW|20570|Zambia|Lusaka
ZWE|ZW|716|AFR|LMC|0|ZWG|16665|Zimbabwe|Harare
`.trim()

/**
 * Fictional focal points. Deliberately generic — see the file header.
 * Assigned deterministically so the same country always shows the same contact.
 */
const FOCAL_FIRST = [
  'A.',
  'B.',
  'C.',
  'D.',
  'E.',
  'F.',
  'G.',
  'H.',
  'J.',
  'K.',
  'L.',
  'M.',
  'N.',
  'P.',
  'R.',
  'S.',
  'T.',
] as const

const FOCAL_LAST = [
  'Almeida',
  'Bakker',
  'Chen',
  'Dubois',
  'Eriksen',
  'Farah',
  'Gopal',
  'Haddad',
  'Ibrahim',
  'Jensen',
  'Kowalski',
  'Lindqvist',
  'Moreau',
  'Nakamura',
  'Okafor',
  'Petrov',
  'Quintero',
  'Rahman',
  'Silva',
  'Tanaka',
  'Ubeda',
  'Vargas',
  'Weber',
  'Yilmaz',
] as const

const REGION_OFFICE: Record<WhoRegion, string> = {
  AFR: 'AFRO',
  AMR: 'PAHO',
  SEAR: 'SEARO',
  EUR: 'EURO',
  EMR: 'EMRO',
  WPR: 'WPRO',
}

function expand(line: string): Country {
  const [iso3, iso2, num, region, income, oecd, ccy, pop, name, capital] = line.split('|')
  if (
    !iso3 ||
    !iso2 ||
    !num ||
    !region ||
    !income ||
    !oecd ||
    !ccy ||
    !pop ||
    !name ||
    !capital
  ) {
    throw new Error(`Malformed country seed row: "${line}"`)
  }
  const whoRegion = region as WhoRegion
  const wbIncome = income as WbIncome
  const focal = `${pick(`ff|${iso3}`, FOCAL_FIRST)} ${pick(`fl|${iso3}`, FOCAL_LAST)}`

  return {
    CODE_ISO_3: iso3,
    CODE_ISO_2: iso2,
    CODE_ISO_NUMERIC: Number(num),
    CODE_WHO: iso3,
    NAME_SHORT_EN: name,
    NAME_FORMAL_EN: name,
    ADJECTIVE_PEOPLE: '',
    CAPITAL_CITY: capital,
    // Non-English names are out of scope for a prototype; the columns exist
    // because xMart has them and Setup displays them (plan §1.3).
    NAME_SHORT_AR: '',
    NAME_SHORT_ES: '',
    NAME_SHORT_FR: '',
    NAME_SHORT_RU: '',
    NAME_SHORT_ZH: '',
    WHO_LEGAL_STATUS: 'MS',
    WHO_LEGAL_STATUS_TITLE: 'Member State',
    SOVEREIGN_ISO_3: iso3,
    GRP_WHO_REGION: whoRegion,
    GRP_WHO_REGION_OFFICE: REGION_OFFICE[whoRegion],
    GRP_WB_INCOME: wbIncome,
    // Seeded in thousands; stored as persons, which is what the per-capita
    // indicators in HLR8 divide by.
    POP_SMALL: Number(pop) * 1000,
    GRP_OECD: oecd === '1',
    CURRENCY_ISO_3: ccy,
    FOCAL_POINT_NAME: focal,
    FOCAL_POINT_EMAIL: `ha.focal.${iso3.toLowerCase()}@example.org`,
    IS_ENABLED: true,
  }
}

export const COUNTRIES: readonly Country[] = RAW.split('\n').map((l) => expand(l.trim()))

export const COUNTRY_BY_ISO3: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((c) => [c.CODE_ISO_3, c]),
)

/**
 * Attribute column definitions for the Setup → Countries grid.
 * `groupable: true` is what makes an attribute appear as a grouping/filter
 * option in Workbooks, Reports and Quality Checks (UC022).
 */
export const COUNTRY_ATTRIBUTES = [
  { key: 'CODE_ISO_3', label: 'ISO3 code', type: 'text', groupable: false, required: true, order: 0, isSystem: true },
  { key: 'NAME_SHORT_EN', label: 'Short name (English)', type: 'text', groupable: false, required: true, order: 1, isSystem: true },
  { key: 'GRP_WHO_REGION', label: 'WHO region', type: 'lov', lov: ['AFR', 'AMR', 'SEAR', 'EUR', 'EMR', 'WPR'], groupable: true, required: true, order: 2, isSystem: true },
  { key: 'GRP_WB_INCOME', label: 'World Bank income group', type: 'lov', lov: ['LIC', 'LMC', 'UMC', 'HIC'], groupable: true, required: true, order: 3, isSystem: true },
  { key: 'GRP_OECD', label: 'OECD member', type: 'boolean', groupable: true, required: false, order: 4, isSystem: false },
  { key: 'CURRENCY_ISO_3', label: 'Currency', type: 'text', groupable: true, required: true, order: 5, isSystem: false },
  { key: 'CODE_ISO_2', label: 'ISO2 code', type: 'text', groupable: false, required: false, order: 6, isSystem: true },
  { key: 'CODE_ISO_NUMERIC', label: 'ISO numeric (UNSD M49)', type: 'number', groupable: false, required: false, order: 7, isSystem: true },
  { key: 'CAPITAL_CITY', label: 'Capital city', type: 'text', groupable: false, required: false, order: 8, isSystem: true },
  { key: 'POP_SMALL', label: 'Population', type: 'number', groupable: false, required: false, order: 9, isSystem: true },
  { key: 'GRP_WHO_REGION_OFFICE', label: 'WHO regional office', type: 'text', groupable: true, required: false, order: 10, isSystem: true },
  { key: 'FOCAL_POINT_NAME', label: 'Focal point', type: 'text', groupable: false, required: false, order: 11, isSystem: false },
  { key: 'FOCAL_POINT_EMAIL', label: 'Focal point email', type: 'text', groupable: false, required: false, order: 12, isSystem: false },
  { key: 'WHO_LEGAL_STATUS_TITLE', label: 'WHO legal status', type: 'text', groupable: true, required: false, order: 13, isSystem: true },
  { key: 'IS_ENABLED', label: 'Enabled', type: 'boolean', groupable: false, required: true, order: 14, isSystem: false },
] as const satisfies readonly import('@/domain/types').AttributeDef[]
