/**
 * Spanish report vocabulary (UC041).
 *
 * Classification labels follow the Spanish edition of *Sistema de Cuentas de
 * Salud 2011* (OCDE / Eurostat / OMS). `ISFLSH` is the SHA abbreviation for
 * NPISH and `n.c.o.p.` ("no clasificado en otra parte") is the Spanish form of
 * `n.e.c.`.
 *
 * Variable codes are identifiers and never move — only the names beside them.
 */

import { UNITS } from '@/domain/constants'
import type { LanguagePack } from './types'

const pack: LanguagePack = {
  language: 'es',

  chrome: {
    grandTotal: 'Total general',
    allColumns: 'Todas las columnas',
    all: 'Todos',
    total: 'Total',
    subtotalTemplate: 'Total {label}',
    valuesUnit: 'Valores',
    mixed: 'mixto',
    truncatedCoordinates:
      'Se detuvo tras {max} combinaciones de país × año × variable. Reduzca la selección para ver el resto.',
    truncatedRows:
      'No se muestran {dropped} de {total} filas: la tabla alcanzó su límite de {max} celdas. Añada un filtro o quite un campo de las filas.',

    sheetReport: 'Informe',
    sheetAbout: 'Acerca de',
    aboutFieldColumn: 'Campo',
    aboutValueColumn: 'Valor',

    aboutReport: 'Informe',
    aboutDescription: 'Descripción',
    aboutRunBy: 'Ejecutado por',
    aboutRunAt: 'Ejecutado el (UTC)',
    aboutCountries: 'Países',
    aboutYears: 'Años',
    aboutVariables: 'Variables',
    aboutUnit: 'Unidad',
    aboutScale: 'Escala',
    aboutLanguage: 'Idioma de las etiquetas',
    aboutRows: 'Filas',
    aboutColumns: 'Columnas',
    aboutValues: 'Valores',
    aboutFilters: 'Filtros',
    aboutGrandTotal: 'Total general',
    aboutCombinationsRead: 'Combinaciones leídas',
    aboutCombinationsFiltered: 'Combinaciones tras los filtros',
    aboutValuesFound: 'Valores encontrados',
    aboutUnitsInTable: 'Unidades presentes en la tabla',
    aboutNotConverted: 'No convertido',
    aboutTruncated: 'Truncado',

    allInScope: 'Todos los del alcance',
    none: 'Ninguno',
    yes: 'Sí',
    no: 'No',
    withSubtotal: 'con subtotal',
    filterIn: 'en',
    filterNotIn: 'fuera de',
    emptyValue: '—',
    notConvertedTemplate:
      '{count} valor(es) sin tipo de cambio para su país y año; quedan excluidos de los totales.',
  },

  fields: {
    country: 'País',
    iso3: 'Código ISO3',
    region: 'Región de la OMS',
    income: 'Grupo de ingresos (Banco Mundial)',
    oecd: 'Pertenencia a la OCDE',
    currency: 'Moneda nacional',
    year: 'Año',
    variable: 'Variable',
    variableCode: 'Código de la variable',
    classification: 'Clasificación',
    unit: 'Unidad de medida',
  },

  aggregations: {
    sum: 'Suma',
    average: 'Promedio',
    min: 'Mínimo',
    max: 'Máximo',
    count: 'Número de valores',
  },

  scales: {
    units: 'unidades',
    thousands: 'miles',
    millions: 'millones',
    billions: 'miles de millones',
  },

  reportUnits: {
    national: 'Moneda nacional (según lo declarado)',
    usd: 'Dólares de EE. UU. (convertidos al tipo de cambio declarado)',
  },

  units: {
    [UNITS.NCU_MILLIONS]: 'Millones de unidades de moneda nacional (UMN)',
    [UNITS.USD_PER_CAPITA]: 'US$ por habitante',
    [UNITS.PERCENT]: 'Porcentajes',
    [UNITS.COUNT]: 'Recuento',
    [UNITS.RATE]: 'Tasa',
  },

  dimensions: {
    AGE: 'Grupo de edad',
    DIS: 'Enfermedad / afección',
    FP: 'Factores de provisión',
    FS: 'Ingresos de los esquemas de financiamiento de la salud (ICHA-FS)',
    FS_RI: 'Fuentes de financiamiento — ingresos de las unidades institucionales',
    GEN: 'Sexo',
    HC: 'Funciones de atención de la salud (ICHA-HC)',
    HC_RI: 'Funciones de atención de la salud — partidas informativas',
    HCR: 'Clases relacionadas con la atención de la salud',
    HF: 'Esquemas de financiamiento de la salud (ICHA-HF)',
    HK: 'Factores de provisión de atención de la salud (ICHA-FP/HK)',
    HKR: 'Factores de provisión — partidas informativas',
    HP: 'Proveedores de atención de la salud (ICHA-HP)',
    IND: 'Indicadores',
    MACRO: 'Series macroeconómicas',
  },

  regions: {
    AFR: 'Región de África',
    AMR: 'Región de las Américas',
    SEAR: 'Región de Asia Sudoriental',
    EUR: 'Región de Europa',
    EMR: 'Región del Mediterráneo Oriental',
    WPR: 'Región del Pacífico Occidental',
  },

  incomes: {
    LIC: 'Ingreso bajo',
    LMC: 'Ingreso mediano bajo',
    UMC: 'Ingreso mediano alto',
    HIC: 'Ingreso alto',
  },

  oecd: {
    OECD: 'OCDE',
    'Non-OECD': 'No OCDE',
  },

  variables: `
HF.1|Esquemas gubernamentales y esquemas contributivos obligatorios de financiamiento de la salud
HF.1.1|Esquemas gubernamentales
HF.1.2|Esquemas contributivos obligatorios de seguro de salud
HF.1.2.1|Esquemas de seguro social de salud
HF.1.2.2|Esquemas de seguro privado obligatorio
HF.1.3|Cuentas de ahorro médico obligatorias (CAMO)
HF.2|Esquemas voluntarios de pago de la atención de la salud
HF.2.1|Esquemas de seguro voluntario de salud
HF.2.2|Esquemas de financiamiento de las ISFLSH
HF.2.3|Esquemas de financiamiento de las empresas
HF.3|Pagos directos de los hogares
HF.3.1|Pagos directos excluida la participación en los costos
HF.3.2|Participación en los costos con terceros pagadores
HF.4|Esquemas de financiamiento del resto del mundo (no residentes)
HF.nec|Esquemas de financiamiento no especificados (n.c.o.p.)
HF TOT|Todos los esquemas de financiamiento
FS.1|Transferencias de ingresos públicos internos
FS.2|Transferencias de origen extranjero distribuidas por el gobierno
FS.3|Contribuciones al seguro social
FS.4|Prepagos obligatorios de fuentes internas
FS.5|Prepagos voluntarios de fuentes internas
FS.6|Otros ingresos internos n.c.o.p.
FS.7|Transferencias extranjeras directas
FS.nec|Ingresos no especificados de los esquemas de financiamiento de la salud (n.c.o.p.)
FS TOT|Todos los ingresos de los esquemas de financiamiento de la salud
HC.1|Atención curativa
HC.1.1|Atención curativa hospitalaria
HC.1.2|Atención curativa de día
HC.1.3|Atención curativa ambulatoria
HC.1.4|Atención curativa domiciliaria
HC.2|Atención de rehabilitación
HC.2.1|Atención de rehabilitación hospitalaria
HC.2.2|Atención de rehabilitación de día
HC.2.3|Atención de rehabilitación ambulatoria
HC.2.4|Atención de rehabilitación domiciliaria
HC.3|Atención de larga duración (salud)
HC.3.1|Atención de larga duración hospitalaria (salud)
HC.3.2|Atención de larga duración de día (salud)
HC.3.3|Atención de larga duración ambulatoria (salud)
HC.3.4|Atención de larga duración domiciliaria (salud)
HC.4|Servicios auxiliares (no especificados por función)
HC.4.1|Servicios de laboratorio
HC.4.2|Servicios de diagnóstico por imagen
HC.4.3|Transporte de pacientes
HC.5|Bienes médicos (no especificados por función)
HC.5.1|Productos farmacéuticos y otros bienes médicos no duraderos
HC.5.1.1|Medicamentos con receta
HC.5.1.2|Medicamentos de venta libre
HC.5.1.3|Otros bienes médicos no duraderos
HC.5.2|Aparatos terapéuticos y otros bienes médicos
HC.6|Atención preventiva
HC.6.1|Programas de información, educación y consejería
HC.6.2|Programas de inmunización
HC.6.3|Programas de detección temprana de enfermedades
HC.6.4|Programas de vigilancia del estado de salud
HC.6.5|Programas de vigilancia epidemiológica y de control de riesgos y enfermedades
HC.6.6|Programas de preparación para desastres y respuesta a emergencias
HC.7|Gobernanza y administración del sistema de salud y de su financiamiento
HC.7.1|Gobernanza y administración del sistema de salud
HC.7.2|Administración del financiamiento de la salud
HC.9|Otros servicios de salud desconocidos (n.c.o.p.)
HC.nec|Funciones de atención de la salud no especificadas (n.c.o.p.)
HC TOT|Todas las funciones de atención de la salud
HP.1|Hospitales
HP.1.1|Hospitales generales
HP.1.2|Hospitales psiquiátricos
HP.1.3|Hospitales especializados (distintos de los psiquiátricos)
HP.2|Establecimientos residenciales de atención de larga duración
HP.2.1|Establecimientos de enfermería de larga duración
HP.2.9|Otros establecimientos residenciales de atención de larga duración
HP.3|Proveedores de atención ambulatoria
HP.3.1|Consultorios médicos
HP.3.2|Consultorios odontológicos
HP.3.3|Otros profesionales de la salud
HP.3.4|Centros de atención ambulatoria
HP.3.5|Proveedores de servicios de atención domiciliaria
HP.4|Proveedores de servicios auxiliares
HP.4.1|Proveedores de transporte de pacientes y rescate de emergencia
HP.4.2|Laboratorios médicos y de diagnóstico
HP.4.9|Otros proveedores de servicios auxiliares
HP.5|Minoristas y otros proveedores de bienes médicos
HP.5.1|Farmacias
HP.5.2|Minoristas y otros proveedores de bienes médicos duraderos
HP.6|Proveedores de atención preventiva
HP.6.1|Proveedores de atención preventiva
HP.7|Proveedores de administración del sistema de salud y de su financiamiento
HP.7.1|Organismos públicos de administración de la salud
HP.7.2|Organismos de seguro social de salud
HP.7.3|Organismos de administración del seguro privado de salud
HP.8|Resto de la economía
HP.9|Resto del mundo
HP.nec|Proveedores de atención de la salud no especificados (n.c.o.p.)
HP TOT|Todos los proveedores de atención de la salud
FP.1|Remuneración de los asalariados
FP.1.1|Sueldos y salarios
FP.1.2|Contribuciones sociales
FP.2|Remuneración de los profesionales independientes
FP.3|Materiales y servicios utilizados
FP.4|Consumo de capital fijo
FP.5|Otras partidas de gasto en insumos
FP.nec|Factores de provisión de atención de la salud no especificados (n.c.o.p.)
FP TOT|Todos los factores de provisión de atención de la salud
HK.1|Formación bruta de capital fijo
HK.1.1|Infraestructura
HK.1.2|Maquinaria y equipo
HK.1.3|Productos de propiedad intelectual
HK.2|Variación de existencias
HK.3|Adquisiciones menos disposiciones de objetos valiosos y activos no producidos
HK.nec|Formación de capital no especificada (n.c.o.p.)
HK TOT|Toda la formación de capital en salud
DIS.1|Enfermedades infecciosas y parasitarias
DIS.1.1|VIH/sida y otras infecciones de transmisión sexual
DIS.1.2|Tuberculosis
DIS.1.3|Malaria
DIS.1.4|Enfermedades prevenibles por vacunación
DIS.1.9|Otras enfermedades infecciosas y parasitarias
DIS.2|Salud reproductiva
DIS.2.1|Afecciones maternas
DIS.2.2|Gestión de la anticoncepción (planificación familiar)
DIS.3|Deficiencias nutricionales
DIS.4|Enfermedades no transmisibles
DIS.4.1|Neoplasias
DIS.4.2|Trastornos endocrinos y metabólicos
DIS.4.3|Enfermedades cardiovasculares
DIS.4.4|Trastornos mentales y del comportamiento
DIS.4.9|Otras enfermedades no transmisibles
DIS.5|Traumatismos
DIS.nec|Otras enfermedades y afecciones no especificadas (n.c.o.p.)
DIS TOT|Todas las enfermedades y afecciones
AGE.1|Menores de 5 años
AGE.2|De 5 a 14 años
AGE.3|De 15 a 59 años
AGE.4|De 60 a 69 años
AGE.5|70 años y más
AGE.nec|Grupo de edad no especificado (n.c.o.p.)
AGE TOT|Todas las edades
GEN.1|Mujeres
GEN.2|Hombres
GEN.nec|Sexo no especificado (n.c.o.p.)
GEN TOT|Ambos sexos
HCR.1|Atención de larga duración (social)
HCR.2|Promoción de la salud con enfoque multisectorial
HCR.nec|Clases relacionadas con la atención de la salud no especificadas (n.c.o.p.)
HCR TOT|Todas las clases relacionadas con la atención de la salud
FS.RI.1|Unidades institucionales que aportan ingresos a los esquemas de financiamiento
FS.RI.1.1|Gobierno
FS.RI.1.2|Sociedades
FS.RI.1.3|Hogares
FS.RI.1.4|ISFLSH
FS.RI.1.5|Resto del mundo
HC.RI.1|Gasto farmacéutico total
HC.RI.2|Medicinas tradicionales, complementarias y alternativas
HC.RI.3|Servicios de prevención y de salud pública
HK.RI.1|Formación de capital por proveedor
HK.RI.2|Transferencias de capital para la salud
GDP|Producto interno bruto (PIB)
GGE|Gasto del gobierno general (GGE)
POP|Población
EXR|Tipo de cambio (unidades de moneda nacional por US$)
PPP|Factor de conversión de paridad del poder adquisitivo
GGHE-D|Gasto público interno general en salud (GGHE-D)
CHE|Gasto corriente en salud (CHE)
CHE%GDP_SHA2011|Gasto corriente en salud (CHE) como % del producto interno bruto (PIB)
CHE_pc_US$_SHA2011|Gasto corriente en salud (CHE) per cápita en US$
PVT-D|Gasto privado interno en salud (PVT-D)
EXT|Gasto en salud procedente de fuentes externas (EXT)
DOM%CHE_SHA2011|Gasto interno en salud (DOM) como % del gasto corriente en salud (CHE)
GGHE-D%CHE_SHA2011|Gasto público interno general en salud (GGHE-D) como % del gasto corriente en salud (CHE)
PVT-D%CHE_SHA2011|Gasto privado interno en salud (PVT-D) como % del gasto corriente en salud (CHE)
OOPS%CHE_SHA2011|Pagos directos de los hogares (OOP) como % del gasto corriente en salud (CHE)
VPP%CHE_SHA2011|Prepagos voluntarios como % del gasto corriente en salud (CHE)
EXT%CHE_SHA2011|Gasto en salud procedente de fuentes externas (EXT) como % del gasto corriente en salud (CHE)
GGHE-D%GDP_SHA2011|Gasto público interno general en salud (GGHE-D) como % del producto interno bruto (PIB)
GGHE-D%GGE_SHA2011|Gasto público interno general en salud (GGHE-D) como % del gasto del gobierno general (GGE)
GGHE-D_pc_US$_SHA2011|Gasto público interno general en salud (GGHE-D) per cápita en US$
PVT-D_pc_US$_SHA2011|Gasto privado interno en salud (PVT-D) per cápita en US$
OLD_CHE_TOT|Heredada: total del gasto corriente en salud (DMS antiguo)
OLD_OOP_SHARE|Heredada: participación de los pagos directos en el CHE (DMS antiguo)
`,
}

export default pack
