/**
 * Leave Planning Inline Table Component
 *
 * Employee-centric expandable table for bulk leave planning.
 * Features:
 * - One row per employee with expand/collapse
 * - View/add/edit/delete multiple vacation periods per employee
 * - Inline editing with auto-save
 * - Real-time conflict detection
 * - Auto-calculation of business days
 */

'use client';

import React, { useState } from 'react';
import { api } from '@/trpc/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LeavePlanningInlineTableProps {
  periodId: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  policyId: string;
  policyName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  notes: string;
  status: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface EmployeeRow {
  employee: Employee;
  requests: LeaveRequest[];
  isExpanded: boolean;
}

interface EditingRequest {
  employeeId: string;
  requestId?: string; // undefined for new requests
  policyId: string;
  startDate: string;
  endDate: string;
  notes: string;
}

export function LeavePlanningInlineTable({ periodId }: LeavePlanningInlineTableProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [editingRequest, setEditingRequest] = useState<EditingRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: requests = [], isLoading: requestsLoading, refetch } = api.leavePlanning.getRequestsForPeriod.useQuery(
    { periodId },
    { enabled: !!periodId }
  );

  const { data: employees = [], isLoading: employeesLoading } = api.leavePlanning.listEmployees.useQuery();
  const { data: policies = [] } = api.leavePlanning.listPolicies.useQuery();

  // Build employee rows
  const employeeRows: EmployeeRow[] = employees.map((emp: any) => ({
    employee: emp,
    requests: requests.filter((r) => r.employeeId === emp.id),
    isExpanded: expandedEmployees.has(emp.id),
  }));

  // Filter by search
  const filteredRows = employeeRows.filter((row) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${row.employee.firstName} ${row.employee.lastName}`.toLowerCase();
    return (
      fullName.includes(query) ||
      row.employee.employeeNumber.toLowerCase().includes(query)
    );
  });

  const isLoading = requestsLoading || employeesLoading;

  // Mutations
  const upsertMutation = api.leavePlanning.upsertRequest.useMutation({
    onSuccess: (result) => {
      toast.success('✅ Enregistré');

      if (result.conflicts && result.conflicts.length > 0) {
        result.conflicts.forEach((conflict) => {
          toast.warning(`⚠️ ${conflict.message}`);
        });
      }

      setEditingRequest(null);
      refetch();
    },
    onError: (error) => {
      toast.error('Erreur lors de l\'enregistrement', {
        description: error.message,
      });
    },
  });

  const deleteMutation = api.leavePlanning.deleteRequest.useMutation({
    onSuccess: () => {
      toast.success('Supprimé');
      refetch();
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', {
        description: error.message,
      });
    },
  });

  // Handlers
  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployees((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const handleAddRequest = (employeeId: string) => {
    setEditingRequest({
      employeeId,
      policyId: '',
      startDate: '',
      endDate: '',
      notes: '',
    });
    setExpandedEmployees((prev) => new Set(prev).add(employeeId));
  };

  const handleEditRequest = (request: LeaveRequest) => {
    setEditingRequest({
      employeeId: request.employeeId,
      requestId: request.id,
      policyId: request.policyId,
      startDate: request.startDate,
      endDate: request.endDate,
      notes: request.notes,
    });
  };

  const handleSaveRequest = async () => {
    if (!editingRequest) return;

    // Validate required fields
    if (!editingRequest.policyId || !editingRequest.startDate || !editingRequest.endDate) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        id: editingRequest.requestId,
        periodId,
        employeeId: editingRequest.employeeId,
        policyId: editingRequest.policyId,
        startDate: editingRequest.startDate,
        endDate: editingRequest.endDate,
        notes: editingRequest.notes,
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette demande de congé ?')) {
      try {
        await deleteMutation.mutateAsync({ requestId });
      } catch (error) {
        // Error handled in mutation
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Chargement des employés...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Planification par employé ({filteredRows.length} employés)
            </CardTitle>
          </div>

          {/* Search filter */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Rechercher un employé par nom ou matricule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md min-h-[44px]"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="min-h-[44px]"
              >
                Effacer
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Empty state */}
        {filteredRows.length === 0 && (
          <div className="text-center py-12">
            <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucun employé trouvé</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? `Aucun résultat pour "${searchQuery}"`
                : 'Aucun employé actif dans votre entreprise'}
            </p>
          </div>
        )}

        {/* Employee table */}
        {filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="min-w-[250px]">Employé</TableHead>
                  <TableHead className="min-w-[150px]">Congés planifiés</TableHead>
                  <TableHead className="text-center min-w-[120px]">Total jours</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const totalDays = row.requests.reduce((sum, r) => sum + r.totalDays, 0);
                  const isEditing = editingRequest?.employeeId === row.employee.id && !editingRequest.requestId;

                  return (
                    <React.Fragment key={row.employee.id}>
                      {/* Employee row */}
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEmployee(row.employee.id)}
                            className="h-8 w-8 p-0"
                          >
                            {row.isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {row.employee.firstName} {row.employee.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              #{row.employee.employeeNumber}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.requests.length === 0 ? (
                              <span className="text-sm text-muted-foreground">
                                Aucun congé planifié
                              </span>
                            ) : (
                              row.requests.slice(0, 3).map((req) => (
                                <Badge key={req.id} variant="outline" className="text-xs">
                                  {req.startDate} → {req.endDate}
                                </Badge>
                              ))
                            )}
                            {row.requests.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{row.requests.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="font-semibold">{totalDays}</span> jours
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRequest(row.employee.id)}
                            className="min-h-[40px]"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Ajouter
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded section with vacation periods */}
                      {row.isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="p-4 space-y-3">
                              {/* Existing requests */}
                              {row.requests.map((request) => {
                                const isEditingThis = editingRequest?.requestId === request.id;

                                return (
                                  <div
                                    key={request.id}
                                    className="bg-background rounded-lg border p-4"
                                  >
                                    {isEditingThis ? (
                                      /* Edit form */
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                          <label className="text-xs font-medium mb-1 block">
                                            Type de congé *
                                          </label>
                                          <Select
                                            value={editingRequest.policyId}
                                            onValueChange={(value) =>
                                              setEditingRequest({ ...editingRequest, policyId: value })
                                            }
                                          >
                                            <SelectTrigger className="min-h-[40px]">
                                              <SelectValue placeholder="Sélectionner..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {policies.map((policy: any) => (
                                                <SelectItem key={policy.id} value={policy.id}>
                                                  {policy.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium mb-1 block">
                                            Date de début *
                                          </label>
                                          <Input
                                            type="date"
                                            value={editingRequest.startDate}
                                            onChange={(e) =>
                                              setEditingRequest({
                                                ...editingRequest,
                                                startDate: e.target.value,
                                              })
                                            }
                                            className="min-h-[40px]"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium mb-1 block">
                                            Date de fin *
                                          </label>
                                          <Input
                                            type="date"
                                            value={editingRequest.endDate}
                                            onChange={(e) =>
                                              setEditingRequest({
                                                ...editingRequest,
                                                endDate: e.target.value,
                                              })
                                            }
                                            className="min-h-[40px]"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium mb-1 block">
                                            Notes
                                          </label>
                                          <Input
                                            type="text"
                                            value={editingRequest.notes}
                                            onChange={(e) =>
                                              setEditingRequest({
                                                ...editingRequest,
                                                notes: e.target.value,
                                              })
                                            }
                                            placeholder="Notes de passation..."
                                            className="min-h-[40px]"
                                          />
                                        </div>

                                        <div className="md:col-span-4 flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancelEdit}
                                          >
                                            Annuler
                                          </Button>
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleSaveRequest}
                                            disabled={upsertMutation.isPending}
                                          >
                                            {upsertMutation.isPending && (
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Enregistrer
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      /* Display mode */
                                      <div className="flex items-start justify-between">
                                        <div className="space-y-1 flex-1">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline">{request.policyName}</Badge>
                                            <Badge
                                              variant={
                                                request.status === 'approved'
                                                  ? 'default'
                                                  : request.status === 'planned'
                                                  ? 'secondary'
                                                  : 'outline'
                                              }
                                            >
                                              {request.status === 'approved' && '✓ Approuvé'}
                                              {request.status === 'planned' && 'Planifié'}
                                              {request.status === 'pending' && 'En attente'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm">
                                            <span className="font-medium">
                                              {request.startDate}
                                            </span>{' '}
                                            →{' '}
                                            <span className="font-medium">{request.endDate}</span>
                                            <span className="text-muted-foreground ml-2">
                                              ({request.totalDays} jours)
                                            </span>
                                          </div>
                                          {request.notes && (
                                            <div className="text-xs text-muted-foreground">
                                              {request.notes}
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditRequest(request)}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteRequest(request.id)}
                                            disabled={deleteMutation.isPending}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* New request form */}
                              {isEditing && (
                                <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-4">
                                  <h4 className="text-sm font-semibold mb-3">
                                    Nouvelle demande de congé
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                      <label className="text-xs font-medium mb-1 block">
                                        Type de congé *
                                      </label>
                                      <Select
                                        value={editingRequest.policyId}
                                        onValueChange={(value) =>
                                          setEditingRequest({ ...editingRequest, policyId: value })
                                        }
                                      >
                                        <SelectTrigger className="min-h-[40px]">
                                          <SelectValue placeholder="Sélectionner..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {policies.map((policy: any) => (
                                            <SelectItem key={policy.id} value={policy.id}>
                                              {policy.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium mb-1 block">
                                        Date de début *
                                      </label>
                                      <Input
                                        type="date"
                                        value={editingRequest.startDate}
                                        onChange={(e) =>
                                          setEditingRequest({
                                            ...editingRequest,
                                            startDate: e.target.value,
                                          })
                                        }
                                        className="min-h-[40px]"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium mb-1 block">
                                        Date de fin *
                                      </label>
                                      <Input
                                        type="date"
                                        value={editingRequest.endDate}
                                        onChange={(e) =>
                                          setEditingRequest({
                                            ...editingRequest,
                                            endDate: e.target.value,
                                          })
                                        }
                                        className="min-h-[40px]"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium mb-1 block">
                                        Notes
                                      </label>
                                      <Input
                                        type="text"
                                        value={editingRequest.notes}
                                        onChange={(e) =>
                                          setEditingRequest({
                                            ...editingRequest,
                                            notes: e.target.value,
                                          })
                                        }
                                        placeholder="Notes de passation..."
                                        className="min-h-[40px]"
                                      />
                                    </div>

                                    <div className="md:col-span-4 flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                      >
                                        Annuler
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleSaveRequest}
                                        disabled={upsertMutation.isPending}
                                      >
                                        {upsertMutation.isPending && (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Enregistrer
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Empty state for employee with no requests */}
                              {row.requests.length === 0 && !isEditing && (
                                <div className="text-center py-6 text-muted-foreground">
                                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">
                                    Aucun congé planifié pour cet employé
                                  </p>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => handleAddRequest(row.employee.id)}
                                    className="mt-2"
                                  >
                                    Ajouter une demande
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
