'use client';

/**
 * Document List Component
 * Epic: Document Management System
 *
 * Features:
 * - List uploaded documents with filters
 * - Show approval status badges
 * - Download documents
 * - HR actions (approve/reject)
 * - Mobile-responsive table
 *
 * Design principles:
 * - Clear visual hierarchy with status badges
 * - One-tap actions on mobile
 * - Progressive disclosure for document details
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Eye,
  Trash2,
  Search,
  Filter,
  X,
  Calendar,
  PenLine,
  History,
  Plus,
} from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/skeletons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { api } from '@/trpc/react';
import { SignatureRequestDialog } from '@/components/documents/signature-request-dialog';
import { DocumentVersionHistory } from '@/components/documents/document-version-history';
import { UploadNewVersionDialog } from '@/components/documents/upload-new-version-dialog';

// =====================================================
// Props Interface
// =====================================================

interface DocumentListProps {
  employeeId?: string; // If provided, show documents for specific employee
  showActions?: boolean; // Show HR actions (approve/reject)
  uploadContext?: string; // If provided, filter by upload context (documents uploaded from this tab)
}

// =====================================================
// Helper Functions
// =====================================================

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approuvé
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Refusé
        </Badge>
      );
    default:
      return null;
  }
}

function getSignatureBadge(status: string | null | undefined) {
  if (!status) return null;

  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
          <PenLine className="h-3 w-3 mr-1" />
          Signature en attente
        </Badge>
      );
    case 'partially_signed':
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
          <PenLine className="h-3 w-3 mr-1" />
          Partiellement signé
        </Badge>
      );
    case 'signed':
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Signé
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Refusé
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary">
          <X className="h-3 w-3 mr-1" />
          Annulé
        </Badge>
      );
    default:
      return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// =====================================================
// Main Component
// =====================================================

export function DocumentList({ employeeId, showActions = false, uploadContext }: DocumentListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const utils = api.useUtils();

  // Fetch documents
  const { data, isLoading } = api.documents.listUploaded.useQuery({
    employeeId,
    approvalStatus: statusFilter === 'all' ? undefined : (statusFilter as any),
    documentCategory: categoryFilter === 'all' ? undefined : categoryFilter,
    uploadContext, // Filter by upload context to show only documents uploaded from this tab
  });

  // Fetch categories for filter
  const { data: categories } = api.documents.getCategories.useQuery();

  // Approve mutation
  const approveMutation = api.documents.approveDocument.useMutation({
    onSuccess: () => {
      utils.documents.listUploaded.invalidate();
      utils.documents.getPendingCount.invalidate();
    },
  });

  // Reject mutation
  const rejectMutation = api.documents.rejectDocument.useMutation({
    onSuccess: () => {
      utils.documents.listUploaded.invalidate();
      utils.documents.getPendingCount.invalidate();
    },
  });

  const handleApprove = async (documentId: string) => {
    if (confirm('Approuver ce document ?')) {
      await approveMutation.mutateAsync({ documentId });
    }
  };

  const handleReject = async (documentId: string) => {
    const reason = prompt('Raison du rejet :');
    if (reason) {
      await rejectMutation.mutateAsync({ documentId, rejectionReason: reason });
    }
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    window.open(fileUrl, '_blank');
  };

  // Client-side filtering
  const filteredDocuments = data?.documents?.filter((doc: any) => {
    // Search query filter
    if (searchQuery && !doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // File type filter
    if (fileTypeFilter !== 'all' && doc.mimeType !== fileTypeFilter) {
      return false;
    }

    // Date range filter
    if (dateFrom && new Date(doc.uploadedAt) < dateFrom) {
      return false;
    }
    if (dateTo && new Date(doc.uploadedAt) > dateTo) {
      return false;
    }

    return true;
  }) || [];

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setFileTypeFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    searchQuery !== '' ||
    fileTypeFilter !== 'all' ||
    dateFrom !== undefined ||
    dateTo !== undefined;

  if (isLoading) {
    return <TableSkeleton rows={4} columns={5} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Documents</span>
          {filteredDocuments.length > 0 && (
            <Badge variant="secondary">{filteredDocuments.length}</Badge>
          )}
        </CardTitle>

        {/* Filter Section */}
        <div className="space-y-4 mt-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom de fichier..."
              className="pl-10 min-h-[48px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="statusFilter" className="text-sm mb-1">
                Statut
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="statusFilter" className="min-h-[48px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="rejected">Refusés</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categoryFilter" className="text-sm mb-1">
                Catégorie
              </Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="categoryFilter" className="min-h-[48px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat.code} value={cat.code}>
                      {cat.labelFr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fileTypeFilter" className="text-sm mb-1">
                Type de fichier
              </Label>
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger id="fileTypeFilter" className="min-h-[48px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="application/pdf">PDF</SelectItem>
                  <SelectItem value="image/jpeg">JPEG</SelectItem>
                  <SelectItem value="image/png">PNG</SelectItem>
                  <SelectItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                    DOCX
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters (Collapsible) */}
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                <Filter className="mr-2 h-4 w-4" />
                {showAdvancedFilters ? 'Masquer' : 'Afficher'} les filtres avancés
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                <div>
                  <Label className="text-sm mb-2 block">Date de début</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full min-h-[48px] justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, 'PP', { locale: fr }) : 'Sélectionner'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Date de fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full min-h-[48px] justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, 'PP', { locale: fr }) : 'Sélectionner'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="w-full min-h-[44px]"
            >
              <X className="mr-2 h-4 w-4" />
              Effacer tous les filtres
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!filteredDocuments.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>
              {data?.documents?.length
                ? 'Aucun document ne correspond aux filtres'
                : 'Aucun document trouvé'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{doc.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {categories?.find((c: any) => c.code === doc.documentCategory)?.labelFr ||
                          doc.documentCategory}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(doc.uploadedAt), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(doc.approvalStatus)}
                        {getSignatureBadge(doc.signatureStatus)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(doc.fileUrl, doc.fileName)}>
                            <Download className="h-4 w-4 mr-2" />
                            Télécharger
                          </DropdownMenuItem>

                          {showActions && doc.approvalStatus === 'approved' && !doc.signatureRequestId && (
                            <SignatureRequestDialog
                              documentId={doc.id}
                              documentName={doc.fileName}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <PenLine className="h-4 w-4 mr-2" />
                                  Demander une signature
                                </DropdownMenuItem>
                              }
                            />
                          )}

                          {/* Version Management Actions */}
                          <DocumentVersionHistory
                            documentId={doc.id}
                            documentName={doc.fileName}
                            isHRManager={showActions}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <History className="h-4 w-4 mr-2" />
                                Historique des versions
                              </DropdownMenuItem>
                            }
                          />

                          <UploadNewVersionDialog
                            originalDocumentId={doc.id}
                            originalDocumentName={doc.fileName}
                            currentVersionNumber={doc.versionNumber || 1}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Plus className="h-4 w-4 mr-2" />
                                Nouvelle version
                              </DropdownMenuItem>
                            }
                          />

                          {showActions && doc.approvalStatus === 'pending' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleApprove(doc.id)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                Approuver
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleReject(doc.id)}
                                disabled={rejectMutation.isPending}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Refuser
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination info */}
        {data && data.total > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''}{' '}
            {hasActiveFilters && `(${data.documents.length} total)`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
