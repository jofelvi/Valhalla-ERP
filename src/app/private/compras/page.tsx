'use client';

import React, { useState } from 'react';
import { PurchaseWizard, PurchasesList } from '@/features/compras';
import { cn } from '@/shared/utils/utils';

type TabType = 'list' | 'new';

export default function ComprasPage() {
  const [activeTab, setActiveTab] = useState<TabType>('list');

  return (
    <div className="min-h-screen bg-ground p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-content mb-2">Compras</h1>
          <p className="text-dim">Gestiona el registro de compras de insumos</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-line">
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              'px-4 py-3 font-medium transition-all border-b-2',
              activeTab === 'list'
                ? 'text-brand border-brand'
                : 'text-dim border-transparent hover:text-content',
            )}
          >
            Historial
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={cn(
              'px-4 py-3 font-medium transition-all border-b-2',
              activeTab === 'new'
                ? 'text-brand border-brand'
                : 'text-dim border-transparent hover:text-content',
            )}
          >
            Nueva Compra
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'list' && <PurchasesList />}
          {activeTab === 'new' && (
            <PurchaseWizard
              onSuccess={() => setActiveTab('list')}
              onCancel={() => setActiveTab('list')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
