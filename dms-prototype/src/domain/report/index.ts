/**
 * The report domain's public surface (plan §Phase 6.1).
 *
 * Pure — no React, no store, no data access. Observations reach it only through
 * the `ReportDataAccess` closure handed to `buildPivot`, which is what lets the
 * same engine serve the run page, the builder preview, the background job queue
 * and the unit tests.
 */

export {
  fieldLabel,
  fieldsBySource,
  isReportField,
  REPORT_FIELD_DEFS,
  REPORT_FIELD_SOURCE_LABELS,
  REPORT_FIELDS,
  type ReportFieldDef,
  type ReportFieldId,
  type ReportFieldSource,
} from './fields'

export {
  BACKGROUND_COORDINATE_THRESHOLD,
  BACKGROUND_COUNTRY_THRESHOLD,
  DEFAULT_VALUE_FIELD,
  defaultParameters,
  describeReport,
  duplicateReport,
  emptyReport,
  placement,
  REPORT_AGGREGATION_LABELS,
  REPORT_AGGREGATIONS,
  REPORT_SCOPE_LABELS,
  reportProblems,
  shouldRunInBackground,
  type ReportAggregation,
  type ReportDefinition,
  type ReportFieldPlacement,
  type ReportFilter,
  type ReportRunParameters,
  type ReportScope,
  type ReportSort,
  type ReportValueField,
} from './definition'

export {
  DEFAULT_PRESENTATION,
  describePresentation,
  isNationalCurrencyUnit,
  MONETARY_MACRO_CODES,
  presentValue,
  REPORT_UNIT_LABELS,
  REPORT_UNIT_SHORT,
  REPORT_UNITS,
  scaleWord,
  type PresentedValue,
  type ReportPresentation,
  type ReportUnit,
} from './units'

export {
  buildPivot,
  DEFAULT_MAX_CELLS,
  DEFAULT_MAX_COORDINATES,
  estimateCoordinates,
  pivotToGrid,
  yearRange,
  type PivotAxisNode,
  type PivotCell,
  type PivotColumn,
  type PivotGrid,
  type PivotNodeKind,
  type PivotRequest,
  type PivotTable,
  type ReportCoordinate,
  type ReportDataAccess,
} from './pivot'
