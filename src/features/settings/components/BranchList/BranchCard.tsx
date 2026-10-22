import React from 'react';
import Link from 'next/link';
import { Building2, MapPin, Eye, Edit, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@/shared';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { Branch } from '@odin6/types';

interface BranchCardProps {
  branch: Branch;
  isCurrentBranch: boolean;
  onDelete: (branchId: string, branchName: string) => void;
  onView: (branchId: string) => void;
}

export default function BranchCard({
  branch,
  isCurrentBranch,
  onDelete,
  onView,
}: BranchCardProps) {
  return (
    <Card
      className={`border-0 bg-surface/80 backdrop-blur-sm hover:shadow-lg transition-all duration-200 ${
        isCurrentBranch ? 'ring-2 ring-brand' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-brand to-brand rounded-lg flex items-center justify-center text-on-brand">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-content flex items-center gap-2">
                {branch.name}
                {isCurrentBranch && (
                  <Badge variant="default" className="text-xs">
                    Activa
                  </Badge>
                )}
                {branch.isDefault && (
                  <Badge variant="outline" className="text-xs">
                    Por defecto
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-1 text-sm text-dim mt-1">
                <MapPin className="w-3 h-3" />
                {branch.city}, {branch.country}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {branch.description && (
          <p className="text-sm text-dim mb-4 line-clamp-2">
            {branch.description}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dim">Dirección:</span>
            <span className="text-content truncate ml-2">
              {branch.location?.address || 'No especificada'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-dim">Teléfono:</span>
            <span className="text-content">
              {branch.phone || 'No especificado'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onView(branch.id)}
          >
            <Eye className="w-3 h-3 mr-1" />
            Ver
          </Button>
          <Link
            href={PRIVATE_ROUTES.SETTINGS_BRANCHES_EDIT(branch.id)}
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="w-full">
              <Edit className="w-3 h-3 mr-1" />
              Editar
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(branch.id, branch.name)}
            className="text-danger hover:text-danger/90 hover:bg-danger/10"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
