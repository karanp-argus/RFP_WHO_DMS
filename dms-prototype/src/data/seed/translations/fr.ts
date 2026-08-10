/**
 * French report vocabulary (UC041).
 *
 * Classification labels follow the French edition of *Système de comptes de la
 * santé 2011* (OCDE / Eurostat / OMS), so an HA focal point reading a French
 * report sees the wording of the manual rather than a literal rendering of the
 * English seed. Where SHA 2011 has an established abbreviation the French keeps
 * it — `ISBLSM` for NPISH, `n.c.a.` for "not elsewhere classified".
 *
 * Indicator codes are **not** translated: `CHE%GDP_SHA2011` is an identifier the
 * HA team types, and a report whose codes changed with the language would break
 * every saved definition. Only the names beside them move.
 */

import { UNITS } from '@/domain/constants'
import type { LanguagePack } from './types'

const pack: LanguagePack = {
  language: 'fr',

  chrome: {
    grandTotal: 'Total général',
    allColumns: 'Toutes les colonnes',
    all: 'Tous',
    total: 'Total',
    // French puts the word first: "Total soins curatifs", not "Soins curatifs — total".
    subtotalTemplate: 'Total {label}',
    valuesUnit: 'Valeurs',
    mixed: 'mixte',
    truncatedCoordinates:
      'Arrêt après {max} combinaisons pays × année × variable. Restreignez la sélection pour voir le reste.',
    truncatedRows:
      '{dropped} lignes sur {total} ne sont pas affichées — le tableau a atteint sa limite de {max} cellules. Ajoutez un filtre ou retirez un champ des lignes.',

    sheetReport: 'Rapport',
    sheetAbout: 'À propos',
    aboutFieldColumn: 'Champ',
    aboutValueColumn: 'Valeur',

    aboutReport: 'Rapport',
    aboutDescription: 'Description',
    aboutRunBy: 'Exécuté par',
    aboutRunAt: 'Exécuté le (UTC)',
    aboutCountries: 'Pays',
    aboutYears: 'Années',
    aboutVariables: 'Variables',
    aboutUnit: 'Unité',
    aboutScale: 'Échelle',
    aboutLanguage: 'Langue des libellés',
    aboutRows: 'Lignes',
    aboutColumns: 'Colonnes',
    aboutValues: 'Valeurs',
    aboutFilters: 'Filtres',
    aboutGrandTotal: 'Total général',
    aboutCombinationsRead: 'Combinaisons lues',
    aboutCombinationsFiltered: 'Combinaisons après filtrage',
    aboutValuesFound: 'Valeurs trouvées',
    aboutUnitsInTable: 'Unités présentes dans le tableau',
    aboutNotConverted: 'Non converti',
    aboutTruncated: 'Tronqué',

    allInScope: 'Tous ceux du périmètre',
    none: 'Aucun',
    yes: 'Oui',
    no: 'Non',
    withSubtotal: 'avec sous-total',
    filterIn: 'parmi',
    filterNotIn: 'hors',
    emptyValue: '—',
    notConvertedTemplate:
      '{count} valeur(s) sans taux de change pour leur pays et leur année ; elles sont exclues des totaux.',
  },

  fields: {
    country: 'Pays',
    iso3: 'Code ISO3',
    region: 'Région OMS',
    income: 'Groupe de revenu (Banque mondiale)',
    oecd: 'Appartenance à l’OCDE',
    currency: 'Monnaie nationale',
    year: 'Année',
    variable: 'Variable',
    variableCode: 'Code de la variable',
    classification: 'Classification',
    unit: 'Unité de mesure',
  },

  aggregations: {
    sum: 'Somme',
    average: 'Moyenne',
    min: 'Minimum',
    max: 'Maximum',
    count: 'Nombre de valeurs',
  },

  scales: {
    units: 'unités',
    thousands: 'milliers',
    millions: 'millions',
    billions: 'milliards',
  },

  reportUnits: {
    national: 'Monnaie nationale (telle que déclarée)',
    usd: 'Dollars US (convertis au taux de change déclaré)',
  },

  units: {
    [UNITS.NCU_MILLIONS]: 'Millions d’unités de monnaie nationale (UMN)',
    [UNITS.USD_PER_CAPITA]: 'US$ par habitant',
    [UNITS.PERCENT]: 'Pourcentages',
    [UNITS.COUNT]: 'Effectif',
    [UNITS.RATE]: 'Taux',
  },

  dimensions: {
    AGE: 'Groupe d’âge',
    DIS: 'Maladie / affection',
    FP: 'Facteurs de prestation',
    FS: 'Recettes des régimes de financement des soins de santé (ICHA-FS)',
    FS_RI: 'Sources de financement — recettes des unités institutionnelles',
    GEN: 'Sexe',
    HC: 'Fonctions des soins de santé (ICHA-HC)',
    HC_RI: 'Fonctions des soins de santé — postes pour mémoire',
    HCR: 'Classes liées aux soins de santé',
    HF: 'Régimes de financement des soins de santé (ICHA-HF)',
    HK: 'Facteurs de prestation des soins de santé (ICHA-FP/HK)',
    HKR: 'Facteurs de prestation — postes pour mémoire',
    HP: 'Prestataires de soins de santé (ICHA-HP)',
    IND: 'Indicateurs',
    MACRO: 'Séries macroéconomiques',
  },

  regions: {
    AFR: 'Région africaine',
    AMR: 'Région des Amériques',
    SEAR: 'Région de l’Asie du Sud-Est',
    EUR: 'Région européenne',
    EMR: 'Région de la Méditerranée orientale',
    WPR: 'Région du Pacifique occidental',
  },

  incomes: {
    LIC: 'Revenu faible',
    LMC: 'Revenu intermédiaire — tranche inférieure',
    UMC: 'Revenu intermédiaire — tranche supérieure',
    HIC: 'Revenu élevé',
  },

  oecd: {
    OECD: 'OCDE',
    'Non-OECD': 'Hors OCDE',
  },

  variables: `
HF.1|Régimes publics et régimes contributifs obligatoires de financement des soins de santé
HF.1.1|Régimes publics
HF.1.2|Régimes contributifs obligatoires d’assurance maladie
HF.1.2.1|Régimes d’assurance maladie sociale
HF.1.2.2|Régimes d’assurance privée obligatoire
HF.1.3|Comptes d’épargne médicale obligatoires (CEMO)
HF.2|Régimes volontaires de paiement des soins de santé
HF.2.1|Régimes d’assurance maladie volontaire
HF.2.2|Régimes de financement des ISBLSM
HF.2.3|Régimes de financement des entreprises
HF.3|Paiements directs des ménages
HF.3.1|Paiements directs hors participation aux coûts
HF.3.2|Participation aux coûts avec des tiers payants
HF.4|Régimes de financement du reste du monde (non-résidents)
HF.nec|Régimes de financement non spécifiés (n.c.a.)
HF TOT|Tous les régimes de financement
FS.1|Transferts provenant des recettes publiques intérieures
FS.2|Transferts d’origine étrangère distribués par les administrations publiques
FS.3|Cotisations d’assurance sociale
FS.4|Prépaiements obligatoires de sources intérieures
FS.5|Prépaiements volontaires de sources intérieures
FS.6|Autres recettes intérieures n.c.a.
FS.7|Transferts étrangers directs
FS.nec|Recettes non spécifiées des régimes de financement des soins de santé (n.c.a.)
FS TOT|Toutes les recettes des régimes de financement des soins de santé
HC.1|Soins curatifs
HC.1.1|Soins curatifs hospitaliers
HC.1.2|Soins curatifs de jour
HC.1.3|Soins curatifs ambulatoires
HC.1.4|Soins curatifs à domicile
HC.2|Soins de réadaptation
HC.2.1|Soins de réadaptation hospitaliers
HC.2.2|Soins de réadaptation de jour
HC.2.3|Soins de réadaptation ambulatoires
HC.2.4|Soins de réadaptation à domicile
HC.3|Soins de longue durée (santé)
HC.3.1|Soins de longue durée hospitaliers (santé)
HC.3.2|Soins de longue durée de jour (santé)
HC.3.3|Soins de longue durée ambulatoires (santé)
HC.3.4|Soins de longue durée à domicile (santé)
HC.4|Services auxiliaires (non spécifiés par fonction)
HC.4.1|Services de laboratoire
HC.4.2|Services d’imagerie
HC.4.3|Transport de patients
HC.5|Biens médicaux (non spécifiés par fonction)
HC.5.1|Produits pharmaceutiques et autres biens médicaux non durables
HC.5.1.1|Médicaments prescrits
HC.5.1.2|Médicaments en vente libre
HC.5.1.3|Autres biens médicaux non durables
HC.5.2|Appareils thérapeutiques et autres biens médicaux
HC.6|Soins préventifs
HC.6.1|Programmes d’information, d’éducation et de conseil
HC.6.2|Programmes de vaccination
HC.6.3|Programmes de détection précoce des maladies
HC.6.4|Programmes de surveillance de l’état de santé
HC.6.5|Programmes de surveillance épidémiologique et de lutte contre les risques et les maladies
HC.6.6|Programmes de préparation aux catastrophes et d’intervention d’urgence
HC.7|Gouvernance et administration du système de santé et de son financement
HC.7.1|Gouvernance et administration du système de santé
HC.7.2|Administration du financement de la santé
HC.9|Autres services de santé non connus (n.c.a.)
HC.nec|Fonctions des soins de santé non spécifiées (n.c.a.)
HC TOT|Toutes les fonctions des soins de santé
HP.1|Hôpitaux
HP.1.1|Hôpitaux généraux
HP.1.2|Hôpitaux psychiatriques
HP.1.3|Hôpitaux spécialisés (autres que psychiatriques)
HP.2|Établissements de soins de longue durée avec hébergement
HP.2.1|Établissements de soins infirmiers de longue durée
HP.2.9|Autres établissements de soins de longue durée avec hébergement
HP.3|Prestataires de soins ambulatoires
HP.3.1|Cabinets médicaux
HP.3.2|Cabinets dentaires
HP.3.3|Autres praticiens de santé
HP.3.4|Centres de soins ambulatoires
HP.3.5|Prestataires de services de soins à domicile
HP.4|Prestataires de services auxiliaires
HP.4.1|Prestataires de transport de patients et de secours d’urgence
HP.4.2|Laboratoires médicaux et de diagnostic
HP.4.9|Autres prestataires de services auxiliaires
HP.5|Détaillants et autres fournisseurs de biens médicaux
HP.5.1|Pharmacies
HP.5.2|Détaillants et autres fournisseurs de biens médicaux durables
HP.6|Prestataires de soins préventifs
HP.6.1|Prestataires de soins préventifs
HP.7|Prestataires d’administration du système de santé et de son financement
HP.7.1|Organismes publics d’administration de la santé
HP.7.2|Organismes d’assurance maladie sociale
HP.7.3|Organismes d’administration de l’assurance maladie privée
HP.8|Reste de l’économie
HP.9|Reste du monde
HP.nec|Prestataires de soins de santé non spécifiés (n.c.a.)
HP TOT|Tous les prestataires de soins de santé
FP.1|Rémunération des salariés
FP.1.1|Salaires et traitements
FP.1.2|Cotisations sociales
FP.2|Rémunération des professionnels indépendants
FP.3|Matériels et services utilisés
FP.4|Consommation de capital fixe
FP.5|Autres postes de dépenses en intrants
FP.nec|Facteurs de prestation des soins de santé non spécifiés (n.c.a.)
FP TOT|Tous les facteurs de prestation des soins de santé
HK.1|Formation brute de capital fixe
HK.1.1|Infrastructures
HK.1.2|Machines et équipements
HK.1.3|Produits de propriété intellectuelle
HK.2|Variations des stocks
HK.3|Acquisitions moins cessions d’objets de valeur et d’actifs non produits
HK.nec|Formation de capital non spécifiée (n.c.a.)
HK TOT|Toute la formation de capital en santé
DIS.1|Maladies infectieuses et parasitaires
DIS.1.1|VIH/sida et autres infections sexuellement transmissibles
DIS.1.2|Tuberculose
DIS.1.3|Paludisme
DIS.1.4|Maladies évitables par la vaccination
DIS.1.9|Autres maladies infectieuses et parasitaires
DIS.2|Santé reproductive
DIS.2.1|Affections maternelles
DIS.2.2|Gestion de la contraception (planification familiale)
DIS.3|Carences nutritionnelles
DIS.4|Maladies non transmissibles
DIS.4.1|Tumeurs
DIS.4.2|Troubles endocriniens et métaboliques
DIS.4.3|Maladies cardiovasculaires
DIS.4.4|Troubles mentaux et du comportement
DIS.4.9|Autres maladies non transmissibles
DIS.5|Traumatismes
DIS.nec|Autres maladies et affections non spécifiées (n.c.a.)
DIS TOT|Toutes les maladies et affections
AGE.1|Moins de 5 ans
AGE.2|5 à 14 ans
AGE.3|15 à 59 ans
AGE.4|60 à 69 ans
AGE.5|70 ans et plus
AGE.nec|Groupe d’âge non spécifié (n.c.a.)
AGE TOT|Tous les âges
GEN.1|Femmes
GEN.2|Hommes
GEN.nec|Sexe non spécifié (n.c.a.)
GEN TOT|Tous sexes confondus
HCR.1|Soins de longue durée (social)
HCR.2|Promotion de la santé avec approche multisectorielle
HCR.nec|Classes liées aux soins de santé non spécifiées (n.c.a.)
HCR TOT|Toutes les classes liées aux soins de santé
FS.RI.1|Unités institutionnelles fournissant des recettes aux régimes de financement
FS.RI.1.1|Administrations publiques
FS.RI.1.2|Sociétés
FS.RI.1.3|Ménages
FS.RI.1.4|ISBLSM
FS.RI.1.5|Reste du monde
HC.RI.1|Dépenses pharmaceutiques totales
HC.RI.2|Médecines traditionnelles, complémentaires et alternatives
HC.RI.3|Services de prévention et de santé publique
HK.RI.1|Formation de capital par prestataire
HK.RI.2|Transferts en capital pour la santé
GDP|Produit intérieur brut (PIB)
GGE|Dépenses des administrations publiques (DAP)
POP|Population
EXR|Taux de change (unités de monnaie nationale par US$)
PPP|Facteur de conversion en parité de pouvoir d’achat
GGHE-D|Dépenses publiques intérieures générales de santé (GGHE-D)
CHE|Dépenses courantes de santé (CHE)
CHE%GDP_SHA2011|Dépenses courantes de santé (CHE) en % du produit intérieur brut (PIB)
CHE_pc_US$_SHA2011|Dépenses courantes de santé (CHE) par habitant en US$
PVT-D|Dépenses privées intérieures de santé (PVT-D)
EXT|Dépenses de santé financées par des sources extérieures (EXT)
DOM%CHE_SHA2011|Dépenses intérieures de santé (DOM) en % des dépenses courantes de santé (CHE)
GGHE-D%CHE_SHA2011|Dépenses publiques intérieures générales de santé (GGHE-D) en % des dépenses courantes de santé (CHE)
PVT-D%CHE_SHA2011|Dépenses privées intérieures de santé (PVT-D) en % des dépenses courantes de santé (CHE)
OOPS%CHE_SHA2011|Paiements directs des ménages (OOP) en % des dépenses courantes de santé (CHE)
VPP%CHE_SHA2011|Prépaiements volontaires en % des dépenses courantes de santé (CHE)
EXT%CHE_SHA2011|Dépenses de santé financées par des sources extérieures (EXT) en % des dépenses courantes de santé (CHE)
GGHE-D%GDP_SHA2011|Dépenses publiques intérieures générales de santé (GGHE-D) en % du produit intérieur brut (PIB)
GGHE-D%GGE_SHA2011|Dépenses publiques intérieures générales de santé (GGHE-D) en % des dépenses des administrations publiques (DAP)
GGHE-D_pc_US$_SHA2011|Dépenses publiques intérieures générales de santé (GGHE-D) par habitant en US$
PVT-D_pc_US$_SHA2011|Dépenses privées intérieures de santé (PVT-D) par habitant en US$
OLD_CHE_TOT|Héritée : total des dépenses courantes de santé (ancien DMS)
OLD_OOP_SHARE|Héritée : part des paiements directs dans la CHE (ancien DMS)
`,
}

export default pack
