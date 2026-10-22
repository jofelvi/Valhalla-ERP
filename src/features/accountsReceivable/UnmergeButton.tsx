'use client';

import { Button } from '@/components/shared/button/Button';
import { Loader2, Unlink } from 'lucide-react';
import { useUnmergeAccount } from '@/hooks/useAccountsReceivable';
import { useRouter } from 'next/navigation';

interface UnmergeButtonProps {
  accountId: string;
  mergedCount: number;
}

export default function UnmergeButton({
  accountId,
  mergedCount,
}: UnmergeButtonProps) {
  const router = useRouter();
  const unmerge = useUnmergeAccount();

  const handleUnmerge = async () => {
    if (
      !confirm(
        `Desunificar esta cuenta?\n\nSe restauraran las ${mergedCount} cuentas originales y se eliminara esta cuenta consolidada.`,
      )
    )
      return;

    try {
      await unmerge.mutateAsync(accountId);
      router.push('/private/accounts-receivable');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desunificar');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleUnmerge}
      disabled={unmerge.isPending}
      className="border-danger text-danger hover:bg-danger/10"
    >
      {unmerge.isPending ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : (
        <Unlink className="w-3.5 h-3.5 mr-1.5" />
      )}
      Desunificar
    </Button>
  );
}
