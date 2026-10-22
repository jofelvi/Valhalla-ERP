import { useState, useCallback, useMemo } from 'react';

/**
 * Hook genérico para gestionar el estado de un modal (o cualquier overlay binario).
 * Soporta múltiples modales independientes por ID.
 *
 * @example
 * const { isOpen, open, close, toggle } = useModal('myModal');
 * <Modal visible={isOpen} onClose={close}>
 *   <TouchableOpacity onPress={toggle}>Toggle</TouchableOpacity>
 * </Modal>
 */
interface ModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const modalRegistry = new Map<string, boolean>();

export const useModal = (id: string = 'default'): ModalState => {
  const [isOpen, setIsOpen] = useState(modalRegistry.get(id) ?? false);

  const open = useCallback(() => {
    modalRegistry.set(id, true);
    setIsOpen(true);
  }, [id]);

  const close = useCallback(() => {
    modalRegistry.set(id, false);
    setIsOpen(false);
  }, [id]);

  const toggle = useCallback(() => {
    const newState = !isOpen;
    modalRegistry.set(id, newState);
    setIsOpen(newState);
  }, [id, isOpen]);

  return useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );
};
