import Modal from '../../components/shared/modal';
import { CategoryForm } from '@/features/categories/CategoryForm';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export default function CategoryModal({ isOpen, onClose }: CategoryModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <CategoryForm isNew onClose={onClose} isFromProduct />
    </Modal>
  );
}
