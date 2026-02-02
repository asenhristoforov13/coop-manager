
export interface Apartment {
  id: string;
  number: string;
  owner: string;
  residents: number;
  balance: number;
  floor: number;
  paysElevator: boolean;
  hasPet: boolean;
}

export interface AppSettings {
  pricePerResident: number;
  pricePerPet: number;
  fixedElevatorFee: number;
  fixedFroFee: number;
  cleaningFeePerResident: number;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
}

export enum ExpenseCategory {
  ELECTRICITY = 'Електричество',
  ELEVATOR = 'Асансьор',
  CLEANING = 'Почистване',
  FRO = 'ФРО',
  OTHER = 'Други'
}

export interface Payment {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  owner: string;
  amount: number;
  date: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  registeredAt: string;
}
