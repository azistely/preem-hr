/**
 * Contracts Table Component
 *
 * Displays all contracts with filtering, sorting, and pagination:
 * - Employee name and number
 * - Contract type (CDI, CDD, CDDTI, etc.)
 * - Contract number
 * - Start and end dates
 * - Status (Active, Terminated, Expiring)
 * - Compliance alerts
 * - Quick actions
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  MoreVertical,
  Eye,
  Edit,
  FileText,
  RefreshCw,
  ArrowRight,
  Trash,
  AlertCircle,
  AlertTriangle,
  PenTool,
  Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/trpc/react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RenewContractDialog } from '@/components/contracts/renew-contract-dialog';
import { ConvertToCDIDialog } from '@/components/contracts/convert-to-cdi-dialog';
import { TerminateContractDialog } from './terminate-contract-dialog';
import { GenerateContractDocumentDialog } from './generate-contract-document-dialog';
import { SendForSignatureDialog } from './send-for-signature-dialog';

interface ContractsTableProps {
  searchQuery?: string;
}

export function ContractsTable({ searchQuery }: ContractsTableProps) {
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Dialog states
  const [renewDialog, setRenewDialog] = useState<{
    open: boolean;
    contractId: string;
    currentEndDate?: Date;
    renewalCount: number;
  }>({ open: false, contractId: '', renewalCount: 0 });

  const [convertDialog, setConvertDialog] = useState<{
    open: boolean;
    contractId: string;
    employeeName: string;
    currentEndDate?: Date;
  }>({ open: false, contractId: '', employeeName: '' });

  const [terminateDialog, setTerminateDialog] = useState<{
    open: boolean;
    contractId: string;
    employeeName: string;
    contractType: string;
  }>({ open: false, contractId: '', employeeName: '', contractType: '' });

  const [generateDialog, setGenerateDialog] = useState<{
    open: boolean;
    contractId: string;
    employeeName: string;
    contractType: string;
    contractNumber?: string;
  }>({ open: false, contractId: '', employeeName: '', contractType: '' });

  const [signatureDialog, setSignatureDialog] = useState<{
    open: boolean;
    documentId?: string;
    contractType: string;
    employeeName: string;
    contractNumber?: string;
  }>({ open: false, contractType: '', employeeName: '' });

  const { data, isLoading } = api.contracts.getAllContracts.useQuery({
    search: searchQuery,
    isActive: true,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sortBy: 'startDate',
    sortOrder: 'desc',
  });

  const getContractTypeVariant = (type: string) => {
    switch (type) {
      case 'CDI':
        return 'default';
      case 'CDD':
        return 'secondary';
      case 'CDDTI':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusBadge = (contract: any) => {
    if (!contract.isActive) {
      return <Badge variant="secondary">Terminé</Badge>;
    }

    if (contract.endDate) {
      const daysRemaining = differenceInDays(new Date(contract.endDate), new Date());

      if (daysRemaining < 0) {
        return <Badge variant="destructive">Expiré</Badge>;
      } else if (daysRemaining <= 30) {
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {daysRemaining}j
          </Badge>
        );
      } else if (daysRemaining <= 90) {
        return (
          <Badge className="bg-orange-600 hover:bg-orange-700 gap-1">
            <AlertTriangle className="h-3 w-3" />
            {daysRemaining}j
          </Badge>
        );
      }
    }

    return <Badge className="bg-green-600 hover:bg-green-700">Actif</Badge>;
  };

  const toggleSelectAll = () => {
    if (selectedContracts.length === data?.contracts.length) {
      setSelectedContracts([]);
    } else {
      setSelectedContracts(data?.contracts.map((c) => c.id) || []);
    }
  };

  const toggleSelectContract = (contractId: string) => {
    setSelectedContracts((prev) =>
      prev.includes(contractId)
        ? prev.filter((id) => id !== contractId)
        : [...prev, contractId]
    );
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox disabled />
              </TableHead>
              <TableHead>Employé</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>N° Contrat</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Checkbox disabled />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data || data.contracts.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Aucun contrat trouvé</p>
        {searchQuery && (
          <p className="text-sm mt-1">Essayez une autre recherche</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedContracts.length === data.contracts.length &&
                    data.contracts.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Employé</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>N° Contrat</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedContracts.includes(contract.id)}
                    onCheckedChange={() => toggleSelectContract(contract.id)}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <Link
                      href={`/employees/${contract.employeeId}`}
                      className="font-medium hover:underline"
                    >
                      {contract.employeeName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {contract.employeeNumber || 'Sans N°'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={getContractTypeVariant(contract.contractType)}>
                      {contract.contractType}
                    </Badge>
                    {contract.signedDate && (
                      <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700 border-orange-200">
                        <Lock className="h-3 w-3" />
                        Signé
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {contract.contractNumber || 'Sans numéro'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {format(new Date(contract.startDate), 'dd MMM yyyy', {
                      locale: fr,
                    })}
                  </span>
                </TableCell>
                <TableCell>
                  {contract.endDate ? (
                    <span className="text-sm">
                      {format(new Date(contract.endDate), 'dd MMM yyyy', {
                        locale: fr,
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Indéterminé
                    </span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(contract)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href={`/employees/${contract.employeeId}/contracts`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir détails
                        </Link>
                      </DropdownMenuItem>
                      {/* Only show edit button for unsigned contracts */}
                      {!contract.signedDate && (
                        <DropdownMenuItem asChild>
                          <Link href={`/contracts/${contract.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          setGenerateDialog({
                            open: true,
                            contractId: contract.id,
                            employeeName: contract.employeeName,
                            contractType: contract.contractType,
                            contractNumber: contract.contractNumber || undefined,
                          })
                        }
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Générer PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setSignatureDialog({
                            open: true,
                            documentId: contract.contractFileUrl || undefined,
                            contractType: contract.contractType,
                            employeeName: contract.employeeName,
                            contractNumber: contract.contractNumber || undefined,
                          })
                        }
                        disabled={!contract.contractFileUrl}
                      >
                        <PenTool className="mr-2 h-4 w-4" />
                        Envoyer pour signature
                      </DropdownMenuItem>
                      {contract.contractType === 'CDD' && contract.renewalCount < 2 && contract.endDate && (
                        <DropdownMenuItem
                          onClick={() =>
                            setRenewDialog({
                              open: true,
                              contractId: contract.id,
                              currentEndDate: new Date(contract.endDate!),
                              renewalCount: contract.renewalCount,
                            })
                          }
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Renouveler
                        </DropdownMenuItem>
                      )}
                      {(contract.contractType === 'CDD' || contract.contractType === 'CDDTI') && (
                        <DropdownMenuItem
                          onClick={() =>
                            setConvertDialog({
                              open: true,
                              contractId: contract.id,
                              employeeName: contract.employeeName,
                              currentEndDate: contract.endDate ? new Date(contract.endDate) : undefined,
                            })
                          }
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Convertir en CDI
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          setTerminateDialog({
                            open: true,
                            contractId: contract.id,
                            employeeName: contract.employeeName,
                            contractType: contract.contractType,
                          })
                        }
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Résilier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage de {(page - 1) * pageSize + 1} à{' '}
            {Math.min(page * pageSize, data.total)} sur {data.total} contrats
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedContracts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
          <span className="font-medium">
            {selectedContracts.length} contrat(s) sélectionné(s)
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedContracts([])}
          >
            Annuler
          </Button>
          <Button variant="secondary" size="sm">
            Exporter
          </Button>
        </div>
      )}

      {/* Action Dialogs */}
      <RenewContractDialog
        open={renewDialog.open}
        onOpenChange={(open) =>
          setRenewDialog((prev) => ({ ...prev, open }))
        }
        contractId={renewDialog.contractId}
        currentEndDate={renewDialog.currentEndDate || new Date()}
        renewalCount={renewDialog.renewalCount}
        onSuccess={() => {
          setRenewDialog({ open: false, contractId: '', renewalCount: 0 });
        }}
      />

      <ConvertToCDIDialog
        open={convertDialog.open}
        onOpenChange={(open) =>
          setConvertDialog((prev) => ({ ...prev, open }))
        }
        contractId={convertDialog.contractId}
        employeeName={convertDialog.employeeName}
        currentEndDate={convertDialog.currentEndDate}
        onSuccess={() => {
          setConvertDialog({ open: false, contractId: '', employeeName: '' });
        }}
      />

      <TerminateContractDialog
        open={terminateDialog.open}
        onOpenChange={(open) =>
          setTerminateDialog((prev) => ({ ...prev, open }))
        }
        contractId={terminateDialog.contractId}
        employeeName={terminateDialog.employeeName}
        contractType={terminateDialog.contractType}
        onSuccess={() => {
          setTerminateDialog({ open: false, contractId: '', employeeName: '', contractType: '' });
        }}
      />

      <GenerateContractDocumentDialog
        open={generateDialog.open}
        onOpenChange={(open) =>
          setGenerateDialog((prev) => ({ ...prev, open }))
        }
        contractId={generateDialog.contractId}
        employeeName={generateDialog.employeeName}
        contractType={generateDialog.contractType}
        contractNumber={generateDialog.contractNumber}
        onSuccess={() => {
          setGenerateDialog({ open: false, contractId: '', employeeName: '', contractType: '' });
        }}
      />

      <SendForSignatureDialog
        open={signatureDialog.open}
        onOpenChange={(open) =>
          setSignatureDialog((prev) => ({ ...prev, open }))
        }
        documentId={signatureDialog.documentId}
        contractType={signatureDialog.contractType}
        employeeName={signatureDialog.employeeName}
        contractNumber={signatureDialog.contractNumber}
        onSuccess={() => {
          setSignatureDialog({ open: false, contractType: '', employeeName: '' });
        }}
      />
    </div>
  );
}
