import type { Nationality } from '@/types/career';

/**
 * Lista curada de nacionalidades para el search de identity (MGC-430).
 * Mantenemos 30-40 entries para que el search funcione bien sin saturar
 * el UI. La bandera es emoji de país como placeholder — el designer
 * (MGC-428) reemplaza con assets reales.
 */
export const NATIONALITIES: Nationality[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'NL', name: 'Países Bajos', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', flag: '🇧🇪' },
  { code: 'HR', name: 'Croacia', flag: '🇭🇷' },
  { code: 'GB', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'JP', name: 'Japón', flag: '🇯🇵' },
  { code: 'KR', name: 'Corea del Sur', flag: '🇰🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CM', name: 'Camerún', flag: '🇨🇲' },
  { code: 'MA', name: 'Marruecos', flag: '🇲🇦' },
  { code: 'EG', name: 'Egipto', flag: '🇪🇬' },
  { code: 'DZ', name: 'Argelia', flag: '🇩🇿' },
  { code: 'TR', name: 'Turquía', flag: '🇹🇷' },
];

export const NATIONALITIES_BY_CODE: Record<string, Nationality> = NATIONALITIES.reduce(
  (acc, n) => {
    acc[n.code] = n;
    return acc;
  },
  {} as Record<string, Nationality>,
);