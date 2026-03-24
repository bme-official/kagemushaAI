export const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

export const isValidPhone = (value: string): boolean => {
  if (!value.trim()) return true;
  return /^[0-9+\-()\s]{8,20}$/.test(value.trim());
};
