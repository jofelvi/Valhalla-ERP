import { useRef } from 'react';
import { useClickOutside } from '@/shared/hooks/useClickOutside';

/**
 * Gestiona un dropdown que se cierra al hacer clic fuera.
 * Delega el patrón click-outside en el hook genérico `useClickOutside`.
 */
export function useWaiterDropdown(isOpen: boolean, onClose: () => void) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(dropdownRef, onClose, isOpen);
  return dropdownRef;
}
