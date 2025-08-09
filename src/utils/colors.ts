export const BEACH_COLORS = {
  // Colores del mar
  oceanBlue: '#1e3a8a',
  seaBlue: '#3b82f6',
  lightBlue: '#60a5fa',
  aqua: '#06b6d4',
  
  // Colores de la playa
  sand: '#fbbf24',
  lightSand: '#fcd34d',
  warmSand: '#f59e0b',
  
  // Colores del sol
  sunset: '#f97316',
  warmOrange: '#fb923c',
  coral: '#fb7185',
  
  // Colores complementarios
  white: '#ffffff',
  lightGray: '#f8fafc',
  darkGray: '#475569'
};

export const getRandomBeachColor = (): string => {
  const colors = Object.values(BEACH_COLORS);
  return colors[Math.floor(Math.random() * colors.length)];
};

export const getCategoryColors = (): string[] => {
  return [
    BEACH_COLORS.oceanBlue,
    BEACH_COLORS.seaBlue,
    BEACH_COLORS.sand,
    BEACH_COLORS.sunset,
    BEACH_COLORS.aqua,
    BEACH_COLORS.coral,
    BEACH_COLORS.warmSand
  ];
}; 