'use client';
import { BranchForm } from '@/features/settings/BranchForm';

export default function NewBranchPage() {
  return (
    <div className="min-h-screen bg-page">
      <div className="container mx-auto px-6 py-8">
        <BranchForm isNew={true} />
      </div>
    </div>
  );
}
