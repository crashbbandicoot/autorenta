// Límites máximos de retención sobre dividendos según convenios de doble imposición con España.
// Fuente: Agencia Tributaria — Manual de Tributación de No Residentes, Anexo: Límites de Imposición
// https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-tributacion-no-residentes/anexos/limites-imposicion-convenios.html
//
// Países sin entrada = sin convenio con España → límite 0 (sin deducción por doble imposición).
// Cuando el convenio establece varios tramos, se usa el tipo general aplicable a dividendos de cartera.

const BASE_RATES: Record<string, number> = {
  AL: 10,  // Albania
  DE: 15,  // Alemania
  AD: 15,  // Andorra
  SA: 5,   // Arabia Saudí
  DZ: 15,  // Argelia
  AR: 15,  // Argentina
  AM: 10,  // Armenia
  AU: 15,  // Australia
  AT: 15,  // Austria
  AZ: 10,  // Azerbaiyán
  BB: 5,   // Barbados
  BE: 15,  // Bélgica
  BY: 10,  // Bielorrusia
  BO: 15,  // Bolivia
  BA: 10,  // Bosnia y Herzegovina
  BR: 15,  // Brasil
  BG: 15,  // Bulgaria
  CV: 10,  // Cabo Verde
  CA: 15,  // Canadá
  QA: 5,   // Catar
  CZ: 15,  // República Checa
  CY: 5,   // Chipre
  CL: 10,  // Chile
  CN: 10,  // China
  CO: 5,   // Colombia
  KR: 15,  // Corea del Sur
  CR: 12,  // Costa Rica
  HR: 15,  // Croacia
  CU: 15,  // Cuba
  DK: 15,  // Dinamarca
  DO: 10,  // República Dominicana
  EC: 15,  // Ecuador
  EG: 12,  // Egipto
  AE: 15,  // Emiratos Árabes Unidos
  SK: 15,  // Eslovaquia
  SI: 15,  // Eslovenia
  US: 15,  // Estados Unidos
  EE: 15,  // Estonia
  PH: 15,  // Filipinas
  FI: 15,  // Finlandia
  FR: 15,  // Francia
  GE: 10,  // Georgia
  GR: 10,  // Grecia
  HK: 10,  // Hong Kong
  HU: 15,  // Hungría
  IN: 15,  // India
  ID: 15,  // Indonesia
  IR: 10,  // Irán
  IE: 15,  // Irlanda
  IS: 15,  // Islandia
  IL: 10,  // Israel
  IT: 15,  // Italia
  JM: 10,  // Jamaica
  JP: 10,  // Japón (nuevo convenio: tipo general cartera)
  KZ: 15,  // Kazajistán
  KW: 5,   // Kuwait
  LV: 10,  // Letonia
  LT: 15,  // Lituania
  LU: 15,  // Luxemburgo
  MK: 15,  // Macedonia del Norte
  MY: 5,   // Malasia
  MT: 5,   // Malta
  MA: 15,  // Marruecos
  MX: 10,  // México (nuevo protocolo)
  MD: 10,  // Moldavia
  NG: 10,  // Nigeria
  NO: 15,  // Noruega
  NZ: 15,  // Nueva Zelanda
  OM: 10,  // Omán
  NL: 15,  // Países Bajos
  PK: 10,  // Pakistán
  PA: 10,  // Panamá
  PY: 10,  // Paraguay
  PL: 15,  // Polonia
  PT: 15,  // Portugal
  GB: 10,  // Reino Unido (nuevo convenio; en la práctica IBKR no retiene → has_treaty=false)
  RO: 5,   // Rumanía (nuevo convenio)
  RU: 15,  // Federación Rusa
  SV: 12,  // El Salvador
  SN: 10,  // Senegal
  RS: 10,  // Serbia
  SG: 5,   // Singapur
  ZA: 15,  // Sudáfrica
  SE: 15,  // Suecia
  CH: 15,  // Suiza (tipo general)
  TH: 10,  // Tailandia
  TT: 10,  // Trinidad y Tobago
  TN: 15,  // Túnez
  TR: 15,  // Turquía
  UY: 5,   // Uruguay
  UZ: 10,  // Uzbekistán
  VE: 10,  // Venezuela
  VN: 15,  // Vietnam
  // Antigua URSS (estados que aún aplican el convenio URSS-España, tipo 18%)
  KG: 18,  // Kirguistán
  TJ: 18,  // Tayikistán
  TM: 18,  // Turkmenistán
};

// Cambios efectivos por año (terminaciones de convenio, nuevos protocolos, etc.)
const YEAR_OVERRIDES: Record<number, Record<string, number>> = {
};

export function getTreatyRate(country: string, year: number): number {
  return YEAR_OVERRIDES[year]?.[country] ?? BASE_RATES[country] ?? 0;
}
