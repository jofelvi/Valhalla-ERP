'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePendingCreditRequests } from '@/hooks/useCreditRequests';
import { useUserStore } from '@/shared/store/useUserStore';
import { useUpdateOrder } from '@/hooks/useOrders';
import { useCreatePayment } from '@/hooks/usePayments';
import { useCreateTip } from '@/hooks/useTips';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { useUpdateTable } from '@/hooks/useTables';
import { PRIVATE_ROUTES } from '@/shared';

import { useVerifyPaymentsData } from './hooks/useVerifyPaymentsData';
import { useVerifyPaymentsSelection } from './hooks/useVerifyPaymentsSelection';
import { useVerifyPaymentsFilters } from './hooks/useVerifyPaymentsFilters';
import { useVerifyPaymentModals } from './hooks/useVerifyPaymentModals';
import { useVerifyPaymentsBulkApprove } from './hooks/useVerifyPaymentsBulkApprove';
import { useVerifyPaymentsBulkReject } from './hooks/useVerifyPaymentsBulkReject';

import {
  SolicitudesDeCredito,
  PESTANA_CREDITOS,
  esPorDecidir,
} from '@/features/creditRequests';
import {
  PestanasDeVerificacion,
  type Pestana,
} from './components/PestanasDeVerificacion';
import { VerifyPaymentsHeader } from './components/VerifyPaymentsHeader';
import { VerifyPaymentsFilters } from './components/VerifyPaymentsFilters';
import { VerifyPaymentsBulkActions } from './components/VerifyPaymentsBulkActions';
import { VerifyPaymentsTable } from './components/VerifyPaymentsTable';
import { VerifyPaymentsImageModal } from './components/VerifyPaymentsImageModal';
import { VerifyPaymentsOcrDetailModal } from './components/VerifyPaymentsOcrDetailModal';
import { VerifyPaymentsApproveModal } from './components/VerifyPaymentsApproveModal';
import { VerifyPaymentsRejectModal } from './components/VerifyPaymentsRejectModal';

export default function VerifyPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUserStore();

  // La pestaña vive en la URL: el aviso del POS enlaza directo a creditos.
  const pestana: Pestana =
    searchParams.get('pestana') === PESTANA_CREDITOS ? 'creditos' : 'pagos';
  const cambiarPestana = (siguiente: Pestana) => {
    const query =
      siguiente === 'creditos' ? `?pestana=${PESTANA_CREDITOS}` : '';
    router.replace(`${PRIVATE_ROUTES.VERIFY_PAYMENTS}${query}`, {
      scroll: false,
    });
  };
  // Misma query key que el bloque de creditos: no agrega peticiones.
  const { data: solicitudes = [] } = usePendingCreditRequests();
  const creditosPorDecidir = solicitudes.filter(esPorDecidir).length;

  // Data hooks
  const {
    pendingOrders,
    isLoading,
    refetch,
    bcvRate,
    allUsers,
    waiterOptions,
    methodOptions,
  } = useVerifyPaymentsData();

  // Selection logic
  const {
    selectedIds,
    selectedOrders,
    toggleSelectAll,
    toggleOne,
    clearSelection,
    isAllFilteredSelected,
  } = useVerifyPaymentsSelection(pendingOrders);

  // Filters logic
  const {
    filterWaiter,
    setFilterWaiter,
    filterMethod,
    setFilterMethod,
    searchTerm,
    setSearchTerm,
    hasActiveFilter,
    filteredOrders,
    clearFilters,
  } = useVerifyPaymentsFilters({
    pendingOrders,
    allUsers,
  });

  // Modals state
  const {
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
  } = useVerifyPaymentModals();

  // Mutations
  const createPayment = useCreatePayment();
  const createInvoice = useCreateInvoice();
  const createTip = useCreateTip();
  const updateOrder = useUpdateOrder();
  const updateTable = useUpdateTable();

  // Bulk approve logic
  const {
    isApproving,
    approveProgress,
    printInvoices,
    setPrintInvoices,
    handleBulkApprove,
  } = useVerifyPaymentsBulkApprove({
    selectedOrders,
    allUsers,
    bcvRate,
    userId: user?.id,
    mutations: {
      createPayment,
      createTip,
      updateOrder,
      updateTable,
      createInvoice,
    },
    onSuccess: () => {
      clearSelection();
      void refetch();
      closeApproveModal();
    },
  });

  // Bulk reject logic
  const { isRejecting, rejectReason, setRejectReason, handleBulkReject } =
    useVerifyPaymentsBulkReject({
      selectedOrders,
      userId: user?.id,
      updateOrder,
      onSuccess: () => {
        clearSelection();
        void refetch();
        closeRejectModal();
      },
    });

  const goToDetail = (orderId: string) => {
    router.push(PRIVATE_ROUTES.POS_PAYMENT(orderId));
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <VerifyPaymentsHeader
        isLoading={isLoading}
        filteredCount={filteredOrders.length}
        totalCount={pendingOrders.length}
        hasActiveFilter={hasActiveFilter}
        onRefresh={() => void refetch()}
      />

      <PestanasDeVerificacion
        activa={pestana}
        onCambiar={cambiarPestana}
        pagos={pendingOrders.length}
        creditos={creditosPorDecidir}
      />

      {pestana === 'creditos' ? (
        <div
          role="tabpanel"
          id="panel-creditos"
          aria-labelledby="pestana-creditos"
        >
          <SolicitudesDeCredito variante="embebida" />
        </div>
      ) : (
        <div role="tabpanel" id="panel-pagos" aria-labelledby="pestana-pagos">
          <VerifyPaymentsFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterWaiter={filterWaiter}
            onWaiterChange={setFilterWaiter}
            filterMethod={filterMethod}
            onMethodChange={setFilterMethod}
            hasActiveFilter={hasActiveFilter}
            onClearFilters={clearFilters}
            waiterOptions={waiterOptions}
            methodOptions={methodOptions}
          />

          <VerifyPaymentsBulkActions
            selectedCount={selectedIds.size}
            selectedOrders={selectedOrders}
            isApproving={isApproving}
            isRejecting={isRejecting}
            approveProgress={approveProgress}
            onRejectClick={() => setShowRejectModal(true)}
            onApproveClick={() => {
              if (selectedOrders.length > 0) setShowApproveModal(true);
            }}
          />

          <VerifyPaymentsTable
            isLoading={isLoading}
            filteredOrders={filteredOrders}
            pendingOrders={pendingOrders}
            allUsers={allUsers}
            selectedIds={selectedIds}
            onToggleSelectAll={() => toggleSelectAll(filteredOrders)}
            onToggleOne={toggleOne}
            isAllFilteredSelected={isAllFilteredSelected(filteredOrders)}
            onOpenImageModal={openImageModal}
            onSetOcrDetailOpen={setOcrDetailOpen}
            onGoToDetail={goToDetail}
          />
        </div>
      )}

      <VerifyPaymentsImageModal
        imageUrl={imageModalUrl}
        imageRotation={imageRotation}
        onClose={closeImageModal}
        onRotateLeft={rotateImageLeft}
        onRotateRight={rotateImageRight}
      />

      <VerifyPaymentsOcrDetailModal
        ocrDetail={ocrDetailOpen}
        onClose={closeOcrDetail}
        onOpenImageModal={openImageModal}
      />

      <VerifyPaymentsApproveModal
        isOpen={showApproveModal}
        isApproving={isApproving}
        selectedCount={selectedOrders.length}
        printInvoices={printInvoices}
        onPrintInvoicesChange={setPrintInvoices}
        onCancel={closeApproveModal}
        onConfirm={() => {
          closeApproveModal();
          void handleBulkApprove();
        }}
      />

      <VerifyPaymentsRejectModal
        isOpen={showRejectModal}
        isRejecting={isRejecting}
        selectedCount={selectedIds.size}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onCancel={() => {
          closeRejectModal();
          setRejectReason('');
        }}
        onConfirm={() => void handleBulkReject()}
      />
    </div>
  );
}
