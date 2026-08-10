/**
 * SHA 2011 / ICHA classifications and their categories.
 *
 * **HF is transcribed verbatim from FR §1**, which lists it in full as the
 * worked example — including `HF.nec` ("Unspecified financing schemes") and
 * `HF TOT` ("All financing schemes"). Getting these exactly right matters: the
 * seeded CHE formula is `HF.1 + HF.2 + HF.3 + HF.4 + HF.nec`, and an HA
 * evaluator will read the codes.
 *
 * The other dimensions follow the published SHA 2011 structure at two to three
 * levels — enough depth for the workbook and cross screens to be realistic
 * without transcribing the whole manual (the FR defers the full list to Annex 2,
 * which is empty in the RFP pack).
 *
 * Format per row: code|level|label
 * A trailing `*` on the code marks a leaf that countries actually report, which
 * is what the observation generator seeds. Everything else is either a parent
 * (summed) or computed by a formula.
 */

import { DIMENSIONS, UNITS, type DimensionCode } from '@/domain/constants'
import type { Classification, Variable } from '@/domain/types'

interface DimSpec {
  code: DimensionCode
  label: string
  isIcha: boolean
  isCurrency: boolean
  rows: string
}

const SPECS: DimSpec[] = [
  {
    code: 'HF',
    label: 'Health care financing schemes (ICHA-HF)',
    isIcha: true,
    isCurrency: true,
    // Verbatim from FR §1.
    rows: `
HF.1|1|Government schemes and compulsory contributory health care financing schemes
HF.1.1*|2|Government schemes
HF.1.2|2|Compulsory contributory health insurance schemes
HF.1.2.1*|3|Social health insurance schemes
HF.1.2.2*|3|Compulsory private insurance schemes
HF.1.3*|2|Compulsory Medical Savings Accounts (CMSA)
HF.2|1|Voluntary health care payment schemes
HF.2.1*|2|Voluntary health insurance schemes
HF.2.2*|2|NPISH financing schemes
HF.2.3*|2|Enterprise financing schemes
HF.3|1|Household out-of-pocket payment
HF.3.1*|2|Out-of-pocket excluding cost-sharing
HF.3.2*|2|Cost-sharing with third-party payers
HF.4*|1|Rest of the world financing schemes (non-resident)
HF.nec*|1|Unspecified financing schemes (n.e.c.)
HF TOT|1|All financing schemes
`,
  },
  {
    code: 'FS',
    label: 'Revenues of health care financing schemes (ICHA-FS)',
    isIcha: true,
    isCurrency: true,
    rows: `
FS.1*|1|Transfers from government domestic revenue
FS.2*|1|Transfers distributed by government from foreign origin
FS.3*|1|Social insurance contributions
FS.4*|1|Compulsory prepayment from domestic sources
FS.5*|1|Voluntary prepayment from domestic sources
FS.6*|1|Other domestic revenues n.e.c.
FS.7*|1|Direct foreign transfers
FS.nec*|1|Unspecified revenues of health care financing schemes (n.e.c.)
FS TOT|1|All revenues of health care financing schemes
`,
  },
  {
    code: 'HC',
    label: 'Health care functions (ICHA-HC)',
    isIcha: true,
    isCurrency: true,
    rows: `
HC.1|1|Curative care
HC.1.1*|2|Inpatient curative care
HC.1.2*|2|Day curative care
HC.1.3*|2|Outpatient curative care
HC.1.4*|2|Home-based curative care
HC.2|1|Rehabilitative care
HC.2.1*|2|Inpatient rehabilitative care
HC.2.2*|2|Day rehabilitative care
HC.2.3*|2|Outpatient rehabilitative care
HC.2.4*|2|Home-based rehabilitative care
HC.3|1|Long-term care (health)
HC.3.1*|2|Inpatient long-term care (health)
HC.3.2*|2|Day long-term care (health)
HC.3.3*|2|Outpatient long-term care (health)
HC.3.4*|2|Home-based long-term care (health)
HC.4|1|Ancillary services (non-specified by function)
HC.4.1*|2|Laboratory services
HC.4.2*|2|Imaging services
HC.4.3*|2|Patient transportation
HC.5|1|Medical goods (non-specified by function)
HC.5.1|2|Pharmaceuticals and other medical non-durable goods
HC.5.1.1*|3|Prescribed medicines
HC.5.1.2*|3|Over-the-counter medicines
HC.5.1.3*|3|Other medical non-durable goods
HC.5.2*|2|Therapeutic appliances and other medical goods
HC.6|1|Preventive care
HC.6.1*|2|Information, education and counselling programmes
HC.6.2*|2|Immunisation programmes
HC.6.3*|2|Early disease detection programmes
HC.6.4*|2|Healthy condition monitoring programmes
HC.6.5*|2|Epidemiological surveillance and risk and disease control programmes
HC.6.6*|2|Preparing for disaster and emergency response programmes
HC.7|1|Governance, and health system and financing administration
HC.7.1*|2|Governance and health system administration
HC.7.2*|2|Administration of health financing
HC.9*|1|Other health care services unknown (n.e.c.)
HC.nec*|1|Unspecified health care functions (n.e.c.)
HC TOT|1|All health care functions
`,
  },
  {
    code: 'HP',
    label: 'Health care providers (ICHA-HP)',
    isIcha: true,
    isCurrency: true,
    rows: `
HP.1|1|Hospitals
HP.1.1*|2|General hospitals
HP.1.2*|2|Mental health hospitals
HP.1.3*|2|Specialised hospitals (other than mental health hospitals)
HP.2|1|Residential long-term care facilities
HP.2.1*|2|Long-term nursing care facilities
HP.2.9*|2|Other residential long-term care facilities
HP.3|1|Providers of ambulatory health care
HP.3.1*|2|Medical practices
HP.3.2*|2|Dental practices
HP.3.3*|2|Other health care practitioners
HP.3.4*|2|Ambulatory health care centres
HP.3.5*|2|Providers of home health care services
HP.4|1|Providers of ancillary services
HP.4.1*|2|Providers of patient transportation and emergency rescue
HP.4.2*|2|Medical and diagnostic laboratories
HP.4.9*|2|Other providers of ancillary services
HP.5|1|Retailers and other providers of medical goods
HP.5.1*|2|Pharmacies
HP.5.2*|2|Retail sellers and other suppliers of durable medical goods
HP.6|1|Providers of preventive care
HP.6.1*|2|Providers of preventive care
HP.7|1|Providers of health care system administration and financing
HP.7.1*|2|Government health administration agencies
HP.7.2*|2|Social health insurance agencies
HP.7.3*|2|Private health insurance administration agencies
HP.8*|1|Rest of economy
HP.9*|1|Rest of the world
HP.nec*|1|Unspecified health care providers (n.e.c.)
HP TOT|1|All health care providers
`,
  },
  {
    code: 'FP',
    label: 'Financing provider / factors of provision (ICHA-FP)',
    isIcha: true,
    isCurrency: true,
    rows: `
FP.1|1|Compensation of employees
FP.1.1*|2|Wages and salaries
FP.1.2*|2|Social contributions
FP.2*|1|Self-employed professional remuneration
FP.3*|1|Materials and services used
FP.4*|1|Consumption of fixed capital
FP.5*|1|Other items of spending on inputs
FP.nec*|1|Unspecified factors of health care provision (n.e.c.)
FP TOT|1|All factors of health care provision
`,
  },
  {
    code: 'HK',
    label: 'Capital formation in health care (ICHA-HK)',
    isIcha: true,
    isCurrency: true,
    rows: `
HK.1|1|Gross fixed capital formation
HK.1.1*|2|Infrastructure
HK.1.2*|2|Machinery and equipment
HK.1.3*|2|Intellectual property products
HK.2*|1|Changes in inventories
HK.3*|1|Acquisitions less disposals of valuables and non-produced assets
HK.nec*|1|Unspecified capital formation (n.e.c.)
HK TOT|1|All capital formation in health care
`,
  },
  {
    code: 'DIS',
    label: 'Disease / condition',
    isIcha: true,
    isCurrency: true,
    rows: `
DIS.1|1|Infectious and parasitic diseases
DIS.1.1*|2|HIV/AIDS and other sexually transmitted diseases
DIS.1.2*|2|Tuberculosis
DIS.1.3*|2|Malaria
DIS.1.4*|2|Vaccine preventable diseases
DIS.1.9*|2|Other infectious and parasitic diseases
DIS.2|1|Reproductive health
DIS.2.1*|2|Maternal conditions
DIS.2.2*|2|Contraceptive management (family planning)
DIS.3*|1|Nutritional deficiencies
DIS.4|1|Noncommunicable diseases
DIS.4.1*|2|Neoplasms
DIS.4.2*|2|Endocrine and metabolic disorders
DIS.4.3*|2|Cardiovascular diseases
DIS.4.4*|2|Mental and behavioural disorders
DIS.4.9*|2|Other noncommunicable diseases
DIS.5*|1|Injuries
DIS.nec*|1|Other and unspecified diseases and conditions (n.e.c.)
DIS TOT|1|All diseases and conditions
`,
  },
  {
    code: 'AGE',
    label: 'Age group',
    isIcha: true,
    isCurrency: true,
    rows: `
AGE.1*|1|Under 5 years
AGE.2*|1|5 to 14 years
AGE.3*|1|15 to 59 years
AGE.4*|1|60 to 69 years
AGE.5*|1|70 years and over
AGE.nec*|1|Unspecified age group (n.e.c.)
AGE TOT|1|All ages
`,
  },
  {
    code: 'GEN',
    label: 'Gender',
    isIcha: true,
    isCurrency: true,
    rows: `
GEN.1*|1|Female
GEN.2*|1|Male
GEN.nec*|1|Unspecified gender (n.e.c.)
GEN TOT|1|All genders
`,
  },
  {
    code: 'HCR',
    label: 'Health care related classes',
    isIcha: true,
    isCurrency: true,
    rows: `
HCR.1*|1|Long-term care (social)
HCR.2*|1|Health promotion with multisectoral approach
HCR.nec*|1|Unspecified health care related classes (n.e.c.)
HCR TOT|1|All health care related classes
`,
  },
  {
    code: 'FS_RI',
    label: 'Revenues of financing schemes — reporting items',
    isIcha: true,
    isCurrency: true,
    rows: `
FS.RI.1*|1|Institutional units providing revenues to financing schemes
FS.RI.1.1*|2|Government
FS.RI.1.2*|2|Corporations
FS.RI.1.3*|2|Households
FS.RI.1.4*|2|NPISH
FS.RI.1.5*|2|Rest of the world
`,
  },
  {
    code: 'HC_RI',
    label: 'Health care functions — reporting items',
    isIcha: true,
    isCurrency: true,
    rows: `
HC.RI.1*|1|Total pharmaceutical expenditure
HC.RI.2*|1|Traditional, complementary and alternative medicines
HC.RI.3*|1|Prevention and public health services
`,
  },
  {
    code: 'HKR',
    label: 'Capital formation — reporting items',
    isIcha: true,
    isCurrency: true,
    rows: `
HK.RI.1*|1|Capital formation by provider
HK.RI.2*|1|Capital transfers for health
`,
  },
  {
    code: 'MACRO',
    label: 'Macroeconomic series',
    isIcha: false,
    isCurrency: false,
    // Sourced by the HA team from World Bank / IMF / UN (FR §3). These are the
    // denominators the seeded indicator formulas divide by.
    rows: `
GDP*|1|Gross Domestic Product (GDP)
GGE*|1|General Government Expenditure (GGE)
POP*|1|Population
EXR*|1|Exchange rate (NCU per US$)
PPP*|1|Purchasing power parity conversion factor
GGHE-D*|1|Domestic General Government Health Expenditure (GGHE-D)
`,
  },
]

/* --------------------------------------------------------------------------
   Build the flat variable list
   -------------------------------------------------------------------------- */

export const CLASSIFICATIONS: readonly Classification[] = SPECS.map((s) => ({
  code: s.code,
  label: s.label,
  isIcha: s.isIcha,
}))

/**
 * Parent code by convention: strip the last dot-segment. `HF.1.2.1` → `HF.1.2`,
 * `HF.1` → null. Reporting-item codes (`FS.RI.1.1`) follow the same rule.
 * `X TOT` and `X.nec` are level-1 siblings with no parent.
 */
function parentOf(code: string, level: number): string | null {
  if (level <= 1) return null
  const i = code.lastIndexOf('.')
  return i < 0 ? null : code.slice(0, i)
}

function buildVariables(): Variable[] {
  const out: Variable[] = []

  for (const spec of SPECS) {
    for (const raw of spec.rows.trim().split('\n')) {
      const [codeRaw, levelRaw, label] = raw.trim().split('|')
      if (!codeRaw || !levelRaw || !label) {
        throw new Error(`Malformed classification row in ${spec.code}: "${raw}"`)
      }
      const isReported = codeRaw.endsWith('*')
      const code = isReported ? codeRaw.slice(0, -1) : codeRaw
      const level = Number(levelRaw)

      out.push({
        code,
        dimension: spec.code,
        label,
        // English only, and deliberately so. The other five WHO languages are
        // seeded in `seed/translations/` and loaded on demand (HLR21/UC041):
        // this module is reached from `mockClient`, which `index.html`
        // references directly, so inlining five languages of labels here would
        // put ~100 kB of text on the sign-in screen and trip `audit:bundle`.
        // The field stays on the record because that is the shape xMart carries.
        labels: { en: label },
        parentCode: parentOf(code, level),
        level,
        // A parent or total is derived by summing children, never reported —
        // which is exactly what makes the formula engine visible in the demo.
        isCalculated: !isReported,
        isCurrency: spec.isCurrency,
        unit: spec.isCurrency ? UNITS.NCU_MILLIONS : UNITS.COUNT,
        sortKey: `${DIMENSIONS.indexOf(spec.code)}`.padStart(2, '0') + `|${code}`,
      })
    }
  }
  return out
}

export const CLASSIFICATION_VARIABLES: readonly Variable[] = buildVariables()

/** Codes countries actually report — the set the observation generator seeds. */
export const REPORTED_CODES: readonly string[] = CLASSIFICATION_VARIABLES.filter(
  (v) => !v.isCalculated,
).map((v) => v.code)

/** Parent/total codes, computed by summing children. */
export const AGGREGATE_CODES: readonly string[] = CLASSIFICATION_VARIABLES.filter(
  (v) => v.isCalculated,
).map((v) => v.code)

export const VARIABLE_BY_CODE: ReadonlyMap<string, Variable> = new Map(
  CLASSIFICATION_VARIABLES.map((v) => [v.code, v]),
)

/** Direct children of a code, for aggregate evaluation and tree rendering. */
export const CHILDREN_BY_CODE: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>()
  for (const v of CLASSIFICATION_VARIABLES) {
    if (v.parentCode == null) continue
    const list = m.get(v.parentCode)
    if (list) list.push(v.code)
    else m.set(v.parentCode, [v.code])
  }
  return m
})()

/** All variable codes belonging to one dimension, in hierarchy order. */
export function variablesInDimension(dim: DimensionCode): readonly Variable[] {
  return CLASSIFICATION_VARIABLES.filter((v) => v.dimension === dim)
}
