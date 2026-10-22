export const getStatusVariantPurchaseOrder = (status: string) => {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'approved':
      return 'default';
    case 'received':
      return 'success';
    case 'canceled':
      return 'destructive';
    case 'partially_received':
      return 'warning';
    default:
      return 'default';
  }
};
