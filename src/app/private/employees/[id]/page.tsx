'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, EditIcon } from 'lucide-react';

import { useEmployeeDetail } from './hooks/useEmployeeDetail';
import { useCustomerLink } from './hooks/useCustomerLink';
import { PersonalInfoCard } from './components/PersonalInfoCard';
import { LaborialInfoCard } from './components/LaborialInfoCard';
import { EmergencyContactCard } from './components/EmergencyContactCard';
import { BankAccountCard } from './components/BankAccountCard';
import { ObservationsCard } from './components/ObservationsCard';
import { MedicalInfoCard } from './components/MedicalInfoCard';
import { DocumentsCard } from './components/DocumentsCard';
import { ProfileSidebar } from './components/ProfileSidebar';
import { QuickActionsCard } from './components/QuickActionsCard';
import { LinkedCustomerCard } from './components/LinkedCustomerCard';
import { LinkCustomerModal } from './components/LinkCustomerModal';

export default function EmployeeDetailPage() {
  const { employee, isLoading, handleBack, handleEdit } = useEmployeeDetail();
  const {
    showLinkModal,
    setShowLinkModal,
    customerSearch,
    setCustomerSearch,
    customers,
    buscandoClientes,
    handleLinkCustomer,
    handleUnlinkCustomer,
  } = useCustomerLink();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-8">
        <p className="text-danger">Empleado no encontrado</p>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver a Empleados
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-content">
            Ficha del Empleado
          </h1>
        </div>
        <Button onClick={handleEdit} className="flex items-center gap-2">
          <EditIcon className="h-4 w-4" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-6">
          <PersonalInfoCard employee={employee} />
          <LaborialInfoCard employee={employee} />
          <EmergencyContactCard employee={employee} />
          <BankAccountCard employee={employee} />
          <ObservationsCard employee={employee} />
          <MedicalInfoCard employee={employee} />
          <DocumentsCard employee={employee} />
        </div>

        {/* Columna derecha - sidebar */}
        <div className="space-y-6">
          <ProfileSidebar employee={employee} />
          <QuickActionsCard employeeId={employee.id} onEdit={handleEdit} />
          <LinkedCustomerCard
            customerId={employee.customerId}
            onOpenLinkModal={() => setShowLinkModal(true)}
          />
        </div>
      </div>

      <LinkCustomerModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        customerSearch={customerSearch}
        onSearchChange={setCustomerSearch}
        customers={customers}
        buscandoClientes={buscandoClientes}
        onSelectCustomer={(customerId: string) =>
          handleLinkCustomer(employee.id, customerId)
        }
        onUnlinkCustomer={() => handleUnlinkCustomer(employee.id)}
        employeeHasLinkedCustomer={!!employee.customerId}
      />
    </div>
  );
}
