import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind のクラスを安全に結合する */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
