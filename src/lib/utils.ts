import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { normalizeContactPhone } from "./phone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhone(phone: string): string {
  return normalizeContactPhone(phone);
}

export function formatPhone(phone: string): string {
  const cleaned = normalizePhone(phone);
  
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
}

