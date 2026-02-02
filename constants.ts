
import { Apartment } from './types';

export const INITIAL_APARTMENTS: Apartment[] = Array.from({ length: 24 }, (_, i) => ({
  id: `${i + 1}`,
  number: `${i + 1}`,
  owner: `Собственик ${i + 1}`,
  residents: Math.floor(Math.random() * 3) + 1,
  balance: -50.00, // По подразбиране всички имат стартов дълг за теста
  floor: Math.floor(i / 3) + 1,
  paysElevator: i > 2,
  hasPet: Math.random() > 0.7
}));
