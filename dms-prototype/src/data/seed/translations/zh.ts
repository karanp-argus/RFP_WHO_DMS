/**
 * Chinese (Simplified) report vocabulary (UC041).
 *
 * Classification labels follow the Chinese terminology of *卫生费用核算体系
 * 2011*（经合组织／欧盟统计局／世界卫生组织）. `为住户服务的非营利机构` is the
 * SHA rendering of NPISH, and `未另分类` is the Chinese form of `n.e.c.`.
 *
 * Variable codes are identifiers and never move — only the names beside them.
 */

import { UNITS } from '@/domain/constants'
import type { LanguagePack } from './types'

const pack: LanguagePack = {
  language: 'zh',

  chrome: {
    grandTotal: '总计',
    allColumns: '所有列',
    all: '全部',
    total: '小计',
    subtotalTemplate: '{label} 小计',
    valuesUnit: '数值个数',
    mixed: '单位不一致',
    truncatedCoordinates:
      '已在 {max} 个「国家 × 年份 × 变量」组合后停止。请缩小选择范围以查看其余部分。',
    truncatedRows:
      '{total} 行中有 {dropped} 行未显示——表格已达到 {max} 个单元格的上限。请添加筛选条件，或从行区域移除一个字段。',

    sheetReport: '报表',
    sheetAbout: '报表说明',
    aboutFieldColumn: '项目',
    aboutValueColumn: '内容',

    aboutReport: '报表',
    aboutDescription: '说明',
    aboutRunBy: '运行人',
    aboutRunAt: '运行时间（UTC）',
    aboutCountries: '国家',
    aboutYears: '年份',
    aboutVariables: '变量',
    aboutUnit: '单位',
    aboutScale: '数量级',
    aboutLanguage: '标签语言',
    aboutRows: '行',
    aboutColumns: '列',
    aboutValues: '值',
    aboutFilters: '筛选条件',
    aboutGrandTotal: '总计',
    aboutCombinationsRead: '已读取组合数',
    aboutCombinationsFiltered: '筛选后组合数',
    aboutValuesFound: '找到的数值个数',
    aboutUnitsInTable: '表中出现的单位',
    aboutNotConverted: '未换算',
    aboutTruncated: '已截断',

    allInScope: '范围内全部',
    none: '无',
    yes: '是',
    no: '否',
    withSubtotal: '含小计',
    filterIn: '属于',
    filterNotIn: '不属于',
    emptyValue: '—',
    notConvertedTemplate: '有 {count} 个数值缺少其国家和年份的汇率，已从合计中剔除。',
  },

  fields: {
    country: '国家',
    iso3: 'ISO3 代码',
    region: '世卫组织区域',
    income: '世界银行收入组别',
    oecd: '经合组织成员情况',
    currency: '本国货币',
    year: '年份',
    variable: '变量',
    variableCode: '变量代码',
    classification: '分类',
    unit: '计量单位',
  },

  aggregations: {
    sum: '合计',
    average: '平均值',
    min: '最小值',
    max: '最大值',
    count: '数值个数',
  },

  scales: {
    units: '单位',
    thousands: '千',
    millions: '百万',
    billions: '十亿',
  },

  reportUnits: {
    national: '本国货币（按上报值）',
    usd: '美元（按上报汇率换算）',
  },

  units: {
    [UNITS.NCU_MILLIONS]: '百万本国货币单位（NCU）',
    [UNITS.USD_PER_CAPITA]: '美元／人均',
    [UNITS.PERCENT]: '百分比',
    [UNITS.COUNT]: '计数',
    [UNITS.RATE]: '比率',
  },

  dimensions: {
    AGE: '年龄组',
    DIS: '疾病／健康状况',
    FP: '服务提供要素',
    FS: '卫生筹资方案的收入（ICHA-FS）',
    FS_RI: '筹资来源——机构单位的收入',
    GEN: '性别',
    HC: '卫生服务功能（ICHA-HC）',
    HC_RI: '卫生服务功能——备查项目',
    HCR: '卫生相关类别',
    HF: '卫生筹资方案（ICHA-HF）',
    HK: '卫生服务提供要素（ICHA-FP/HK）',
    HKR: '服务提供要素——备查项目',
    HP: '卫生服务提供者（ICHA-HP）',
    IND: '指标',
    MACRO: '宏观经济序列',
  },

  regions: {
    AFR: '非洲区域',
    AMR: '美洲区域',
    SEAR: '东南亚区域',
    EUR: '欧洲区域',
    EMR: '东地中海区域',
    WPR: '西太平洋区域',
  },

  incomes: {
    LIC: '低收入',
    LMC: '中等偏下收入',
    UMC: '中等偏上收入',
    HIC: '高收入',
  },

  oecd: {
    OECD: '经合组织成员',
    'Non-OECD': '非经合组织成员',
  },

  variables: `
HF.1|政府方案与强制性缴费型卫生筹资方案
HF.1.1|政府方案
HF.1.2|强制性缴费型医疗保险方案
HF.1.2.1|社会医疗保险方案
HF.1.2.2|强制性私人保险方案
HF.1.3|强制性医疗储蓄账户（CMSA）
HF.2|自愿性卫生支付方案
HF.2.1|自愿性医疗保险方案
HF.2.2|为住户服务的非营利机构筹资方案
HF.2.3|企业筹资方案
HF.3|住户自付支出
HF.3.1|不含费用分担的自付支出
HF.3.2|与第三方付费者的费用分担
HF.4|世界其他地区筹资方案（非居民）
HF.nec|未另分类的筹资方案
HF TOT|所有筹资方案
FS.1|来自国内政府收入的转移
FS.2|由政府分配的境外来源转移
FS.3|社会保险缴费
FS.4|来自国内来源的强制性预付
FS.5|来自国内来源的自愿性预付
FS.6|其他未另分类的国内收入
FS.7|境外直接转移
FS.nec|未另分类的卫生筹资方案收入
FS TOT|卫生筹资方案的全部收入
HC.1|治疗性服务
HC.1.1|住院治疗性服务
HC.1.2|日间治疗性服务
HC.1.3|门诊治疗性服务
HC.1.4|居家治疗性服务
HC.2|康复性服务
HC.2.1|住院康复性服务
HC.2.2|日间康复性服务
HC.2.3|门诊康复性服务
HC.2.4|居家康复性服务
HC.3|长期照护（卫生）
HC.3.1|住院长期照护（卫生）
HC.3.2|日间长期照护（卫生）
HC.3.3|门诊长期照护（卫生）
HC.3.4|居家长期照护（卫生）
HC.4|辅助性服务（未按功能细分）
HC.4.1|实验室服务
HC.4.2|影像服务
HC.4.3|患者转运
HC.5|医疗产品（未按功能细分）
HC.5.1|药品及其他非耐用医疗产品
HC.5.1.1|处方药
HC.5.1.2|非处方药
HC.5.1.3|其他非耐用医疗产品
HC.5.2|治疗器具及其他医疗产品
HC.6|预防性服务
HC.6.1|信息、教育与咨询项目
HC.6.2|免疫接种项目
HC.6.3|疾病早期发现项目
HC.6.4|健康状况监测项目
HC.6.5|流行病学监测与风险及疾病控制项目
HC.6.6|备灾与应急响应项目
HC.7|治理以及卫生系统与筹资管理
HC.7.1|治理与卫生系统管理
HC.7.2|卫生筹资管理
HC.9|其他不明卫生服务（未另分类）
HC.nec|未另分类的卫生服务功能
HC TOT|所有卫生服务功能
HP.1|医院
HP.1.1|综合医院
HP.1.2|精神卫生医院
HP.1.3|专科医院（精神卫生医院除外）
HP.2|长期照护住宿机构
HP.2.1|长期护理机构
HP.2.9|其他长期照护住宿机构
HP.3|门诊卫生服务提供者
HP.3.1|医生诊所
HP.3.2|牙科诊所
HP.3.3|其他卫生从业人员
HP.3.4|门诊卫生服务中心
HP.3.5|居家卫生服务提供者
HP.4|辅助性服务提供者
HP.4.1|患者转运与紧急救援服务提供者
HP.4.2|医学与诊断实验室
HP.4.9|其他辅助性服务提供者
HP.5|医疗产品零售商及其他供应者
HP.5.1|药店
HP.5.2|耐用医疗产品零售商及其他供应者
HP.6|预防性服务提供者
HP.6.1|预防性服务提供者
HP.7|卫生系统与筹资管理服务提供者
HP.7.1|政府卫生行政机构
HP.7.2|社会医疗保险机构
HP.7.3|私人医疗保险管理机构
HP.8|国民经济其他部门
HP.9|世界其他地区
HP.nec|未另分类的卫生服务提供者
HP TOT|所有卫生服务提供者
FP.1|雇员报酬
FP.1.1|工资与薪金
FP.1.2|社会缴费
FP.2|自雇专业人员报酬
FP.3|所用材料与服务
FP.4|固定资本消耗
FP.5|其他投入支出项目
FP.nec|未另分类的卫生服务提供要素
FP TOT|所有卫生服务提供要素
HK.1|固定资本形成总额
HK.1.1|基础设施
HK.1.2|机器与设备
HK.1.3|知识产权产品
HK.2|存货变动
HK.3|贵重物品与非生产性资产的购置减处置
HK.nec|未另分类的资本形成
HK TOT|卫生领域全部资本形成
DIS.1|传染病与寄生虫病
DIS.1.1|艾滋病毒／艾滋病及其他性传播感染
DIS.1.2|结核病
DIS.1.3|疟疾
DIS.1.4|疫苗可预防疾病
DIS.1.9|其他传染病与寄生虫病
DIS.2|生殖健康
DIS.2.1|孕产妇疾患
DIS.2.2|避孕管理（计划生育）
DIS.3|营养缺乏
DIS.4|非传染性疾病
DIS.4.1|肿瘤
DIS.4.2|内分泌与代谢疾病
DIS.4.3|心血管疾病
DIS.4.4|精神与行为障碍
DIS.4.9|其他非传染性疾病
DIS.5|伤害
DIS.nec|其他及未另分类的疾病与健康状况
DIS TOT|所有疾病与健康状况
AGE.1|5 岁以下
AGE.2|5 至 14 岁
AGE.3|15 至 59 岁
AGE.4|60 至 69 岁
AGE.5|70 岁及以上
AGE.nec|未另分类的年龄组
AGE TOT|所有年龄
GEN.1|女性
GEN.2|男性
GEN.nec|未另分类的性别
GEN TOT|所有性别
HCR.1|长期照护（社会）
HCR.2|多部门协同的健康促进
HCR.nec|未另分类的卫生相关类别
HCR TOT|所有卫生相关类别
FS.RI.1|向筹资方案提供收入的机构单位
FS.RI.1.1|政府
FS.RI.1.2|企业
FS.RI.1.3|住户
FS.RI.1.4|为住户服务的非营利机构
FS.RI.1.5|世界其他地区
HC.RI.1|药品支出总额
HC.RI.2|传统医学、补充医学与替代医学
HC.RI.3|预防与公共卫生服务
HK.RI.1|按提供者划分的资本形成
HK.RI.2|卫生资本转移
GDP|国内生产总值（GDP）
GGE|广义政府支出（GGE）
POP|人口
EXR|汇率（每美元折合的本国货币单位）
PPP|购买力平价换算系数
GGHE-D|国内广义政府卫生支出（GGHE-D）
CHE|经常性卫生支出（CHE）
CHE%GDP_SHA2011|经常性卫生支出（CHE）占国内生产总值（GDP）的百分比
CHE_pc_US$_SHA2011|人均经常性卫生支出（CHE），美元
PVT-D|国内私人卫生支出（PVT-D）
EXT|来自外部来源的卫生支出（EXT）
DOM%CHE_SHA2011|国内卫生支出（DOM）占经常性卫生支出（CHE）的百分比
GGHE-D%CHE_SHA2011|国内广义政府卫生支出（GGHE-D）占经常性卫生支出（CHE）的百分比
PVT-D%CHE_SHA2011|国内私人卫生支出（PVT-D）占经常性卫生支出（CHE）的百分比
OOPS%CHE_SHA2011|住户自付支出（OOP）占经常性卫生支出（CHE）的百分比
VPP%CHE_SHA2011|自愿性预付占经常性卫生支出（CHE）的百分比
EXT%CHE_SHA2011|来自外部来源的卫生支出（EXT）占经常性卫生支出（CHE）的百分比
GGHE-D%GDP_SHA2011|国内广义政府卫生支出（GGHE-D）占国内生产总值（GDP）的百分比
GGHE-D%GGE_SHA2011|国内广义政府卫生支出（GGHE-D）占广义政府支出（GGE）的百分比
GGHE-D_pc_US$_SHA2011|人均国内广义政府卫生支出（GGHE-D），美元
PVT-D_pc_US$_SHA2011|人均国内私人卫生支出（PVT-D），美元
OLD_CHE_TOT|旧版：经常性卫生支出合计（旧 DMS）
OLD_OOP_SHARE|旧版：自付支出占 CHE 的比重（旧 DMS）
`,
}

export default pack
