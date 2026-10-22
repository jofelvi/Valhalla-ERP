import { useState, useCallback } from 'react';
import { orderService } from '../../../services';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';

interface AddNoteLogicParams {
  orderId: string;
  userUid?: string;
  userDisplayName?: string;
}

export const useAddNoteLogic = ({
  orderId,
  userUid,
  userDisplayName,
}: AddNoteLogicParams) => {
  const addNoteModal = useModal('orderDetailAddNote');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddAdditionalNote = useCallback(async () => {
    const text = newNoteText.trim();
    if (!text) {
      showAlert('Atencion', 'Escribe el contenido de la nota');
      return;
    }
    setIsAddingNote(true);
    try {
      await orderService.addAdditionalNote(
        orderId,
        text,
        userUid,
        userDisplayName,
      );
      setNewNoteText('');
      addNoteModal.close();
    } catch {
      showAlert('Error', 'No se pudo agregar la nota');
    } finally {
      setIsAddingNote(false);
    }
  }, [newNoteText, orderId, userUid, userDisplayName, addNoteModal]);

  return {
    addNoteModal,
    newNoteText,
    setNewNoteText,
    isAddingNote,
    handleAddAdditionalNote,
  };
};
