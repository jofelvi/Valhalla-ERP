'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileTextIcon,
  UploadIcon,
  ExternalLinkIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import { Employee, EmployeeDocument } from '@odin6/types';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  getDocumentStatus,
  getStatusBadge,
} from '../utils/documentUtils';
import { formatDate } from '../utils/formatters';
import { useDocumentManagement } from '../hooks/useDocumentManagement';

interface DocumentsCardProps {
  employee: Employee;
}

export const DocumentsCard = ({ employee }: DocumentsCardProps) => {
  const {
    showDocUpload,
    setShowDocUpload,
    docFile,
    docType,
    setDocType,
    docName,
    setDocName,
    docExpiry,
    setDocExpiry,
    docNotes,
    setDocNotes,
    docUploading,
    resetDocForm,
    handleDocFileChange,
    handleUploadDocument,
    handleDeleteDocument,
  } = useDocumentManagement(employee.id);

  const documents = employee.documents ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5 text-brand" />
            Documentos
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDocUpload(!showDocUpload)}
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            Subir documento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload form */}
        {showDocUpload && (
          <div className="border border-line bg-gradient-to-r from-page/50 to-elevated/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-content flex items-center gap-2">
                <UploadIcon className="h-4 w-4 text-brand" />
                Subir nuevo documento
              </h4>
              <button
                type="button"
                onClick={resetDocForm}
                className="text-brand/60 hover:text-content transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de documento</Label>
                <Select
                  value={docType}
                  onValueChange={(val) => setDocType(val as typeof docType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {DOCUMENT_TYPE_LABELS[dt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nombre descriptivo</Label>
                <Input
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Ej: Cedula V-12345678"
                />
              </div>

              <div>
                <Label>Archivo</Label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleDocFileChange}
                  className="block w-full text-sm text-dim bg-surface/90 backdrop-blur-sm
                    border border-line rounded-xl shadow-sm transition-all duration-200
                    file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                    file:text-sm file:font-semibold
                    file:bg-gradient-to-r file:from-page file:to-elevated file:text-dim
                    hover:file:from-surface hover:file:to-elevated
                    focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div>
                <Label>Fecha de vencimiento (opcional)</Label>
                <Input
                  type="date"
                  value={docExpiry}
                  onChange={(e) => setDocExpiry(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="Notas adicionales sobre el documento"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleUploadDocument(employee)}
                disabled={!docFile || docUploading}
                size="sm"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                {docUploading ? 'Subiendo...' : 'Subir documento'}
              </Button>
              <Button variant="outline" size="sm" onClick={resetDocForm}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Document list */}
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileTextIcon className="h-10 w-10 text-brand-light mx-auto mb-2" />
            <p className="text-sm text-brand/60">No hay documentos cargados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc: EmployeeDocument) => {
              const status = getDocumentStatus(doc);
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-elevated/30 border border-line/50 hover:bg-elevated/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                      <FileTextIcon className="h-4 w-4 text-brand" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-content truncate">
                          {doc.name}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {DOCUMENT_TYPE_LABELS[doc.type]}
                        </Badge>
                        {getStatusBadge(status)}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {doc.expiryDate && (
                          <p className="text-xs text-brand/60">
                            Vence: {formatDate(doc.expiryDate)}
                          </p>
                        )}
                        {doc.notes && (
                          <p className="text-xs text-brand/50 truncate">
                            {doc.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(doc.url, '_blank')}
                      title="Ver/Descargar"
                      className="text-brand hover:text-content hover:bg-elevated"
                    >
                      <ExternalLinkIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(employee, doc.id)}
                      title="Eliminar"
                      className="text-danger/60 hover:text-danger hover:bg-danger/10"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
