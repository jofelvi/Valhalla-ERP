import { ChangeEvent, useState } from 'react';
import { EmployeeDocument, EmployeeDocumentType } from '@odin6/types';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { uploadFile } from '@/services/uploads/uploadImage';
import { DOCUMENT_TYPE_LABELS } from '../utils/documentUtils';

export const useDocumentManagement = (_employeeId: string | undefined) => {
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<EmployeeDocumentType>('cedula');
  const [docName, setDocName] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docUploading, setDocUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEmployee = useUpdateEmployee();

  const handleDocFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setDocFile(e.target.files[0]);
      if (!docName) {
        setDocName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const resetDocForm = () => {
    setShowDocUpload(false);
    setDocFile(null);
    setDocType('cedula');
    setDocName('');
    setDocExpiry('');
    setDocNotes('');
    setError(null);
  };

  const handleUploadDocument = async (
    employee: { id: string; documents?: EmployeeDocument[] | null } | null,
  ) => {
    if (!docFile || !employee) return;

    try {
      setDocUploading(true);
      const url = await uploadFile(docFile, 'employees/docs');

      const newDoc: EmployeeDocument = {
        id: crypto.randomUUID(),
        type: docType,
        name: docName || DOCUMENT_TYPE_LABELS[docType],
        url,
        expiryDate: docExpiry || null,
        uploadedAt: new Date().toISOString(),
        notes: docNotes || null,
      };

      const currentDocs = employee.documents ?? [];
      const updatedDocs = [...currentDocs, newDoc];

      await updateEmployee.mutateAsync({
        id: employee.id,
        data: {
          documents: updatedDocs,
          updatedAt: new Date(),
        },
      });

      resetDocForm();
    } catch {
      setError('Error al subir documento');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteDocument = async (
    employee: { id: string; documents?: EmployeeDocument[] | null } | null,
    docId: string,
  ) => {
    if (!employee) return;
    if (!window.confirm('¿Seguro que desea eliminar este documento?')) return;

    try {
      const updatedDocs = (employee.documents ?? []).filter(
        (d) => d.id !== docId,
      );
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: {
          documents: updatedDocs,
          updatedAt: new Date(),
        },
      });
    } catch {
      setError('Error al eliminar documento');
    }
  };

  return {
    showDocUpload,
    setShowDocUpload,
    docFile,
    setDocFile,
    docType,
    setDocType,
    docName,
    setDocName,
    docExpiry,
    setDocExpiry,
    docNotes,
    setDocNotes,
    docUploading,
    error,
    resetDocForm,
    handleDocFileChange,
    handleUploadDocument,
    handleDeleteDocument,
  };
};
