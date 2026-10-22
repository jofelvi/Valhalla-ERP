import { useState } from 'react';
import { PendingPaymentOcr } from '@odin6/types';

export const useVerifyPaymentModals = () => {
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [ocrDetailOpen, setOcrDetailOpen] = useState<PendingPaymentOcr | null>(
    null,
  );
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const openImageModal = (url: string) => {
    setImageModalUrl(url);
    setImageRotation(0);
  };

  const rotateImageLeft = () => {
    setImageRotation((r) => (r - 90 + 360) % 360);
  };

  const rotateImageRight = () => {
    setImageRotation((r) => (r + 90) % 360);
  };

  const closeImageModal = () => {
    setImageModalUrl(null);
  };

  const closeOcrDetail = () => {
    setOcrDetailOpen(null);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
  };

  return {
    imageModalUrl,
    imageRotation,
    ocrDetailOpen,
    showApproveModal,
    showRejectModal,
    openImageModal,
    rotateImageLeft,
    rotateImageRight,
    closeImageModal,
    setOcrDetailOpen,
    closeOcrDetail,
    setShowApproveModal,
    closeApproveModal,
    setShowRejectModal,
    closeRejectModal,
  };
};
