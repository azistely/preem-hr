/**
 * Geofencing Configuration Page (P1-6)
 *
 * Task-oriented design: "Gérer les zones de pointage"
 * Following HCI principles:
 * - Zero learning curve (map-like location cards + simple form)
 * - Smart defaults (100m radius, applies to all)
 * - Progressive disclosure (list → form → employee assignment)
 * - Mobile-first (responsive cards, touch targets ≥ 44px)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MapPin,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Users,
  Check,
  X,
  Navigation,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Textarea } from '@/components/ui/textarea';

export default function GeofencingPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<any>(null);
  const [assigningGeofence, setAssigningGeofence] = useState<any>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    radiusMeters: 100,
    isActive: true,
    appliesToAll: true,
  });

  // Fetch geofences
  const { data: geofences, isLoading, refetch } = trpc.geofencing.list.useQuery();

  // Fetch active employees for assignment
  const { data: employeesData } = trpc.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  const employees = employeesData?.employees || [];

  // Mutations
  const createMutation = trpc.geofencing.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = trpc.geofencing.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingGeofence(null);
      resetForm();
    },
  });

  const deleteMutation = trpc.geofencing.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const assignMutation = trpc.geofencing.assignEmployees.useMutation({
    onSuccess: () => {
      refetch();
      setAssigningGeofence(null);
      setSelectedEmployees([]);
    },
  });

  const clearAssignmentsMutation = trpc.geofencing.clearAssignments.useMutation({
    onSuccess: () => {
      refetch();
      setAssigningGeofence(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      latitude: '',
      longitude: '',
      radiusMeters: 100,
      isActive: true,
      appliesToAll: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      radiusMeters: formData.radiusMeters,
      isActive: formData.isActive,
      appliesToAll: formData.appliesToAll,
    });
  };

  const handleUpdate = () => {
    if (!editingGeofence) return;

    updateMutation.mutate({
      id: editingGeofence.id,
      name: formData.name,
      description: formData.description || undefined,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      radiusMeters: formData.radiusMeters,
      isActive: formData.isActive,
      appliesToAll: formData.appliesToAll,
    });
  };

  const handleEdit = (geofence: any) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radiusMeters: geofence.radiusMeters,
      isActive: geofence.isActive,
      appliesToAll: geofence.appliesToAll,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce géorepérage ?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAssignEmployees = () => {
    if (!assigningGeofence || selectedEmployees.length === 0) return;

    assignMutation.mutate({
      geofenceId: assigningGeofence.id,
      employeeIds: selectedEmployees,
    });
  };

  const handleClearAssignments = () => {
    if (!assigningGeofence) return;
    if (confirm('Appliquer ce géorepérage à tous les employés ?')) {
      clearAssignmentsMutation.mutate({ geofenceId: assigningGeofence.id });
    }
  };

  const openAssignDialog = (geofence: any) => {
    setAssigningGeofence(geofence);
    setSelectedEmployees(
      geofence.employeeAssignments?.map((a: any) => a.employeeId) || []
    );
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Géorepérage</h1>
          <p className="text-muted-foreground mt-2">
            Configuration des zones de pointage
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="min-h-[48px]">
              <Plus className="mr-2 h-5 w-5" />
              Ajouter une zone
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Nouvelle zone de géorepérage</DialogTitle>
              <DialogDescription>
                Définir une zone géographique pour le pointage
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la zone *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Siège social Abidjan"
                  className="min-h-[48px]"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Informations complémentaires"
                  rows={2}
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude *</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData({ ...formData, latitude: e.target.value })
                    }
                    placeholder="ex: 5.345317"
                    className="min-h-[48px]"
                    required
                  />
                  <p className="text-xs text-muted-foreground">-90 à 90</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude *</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData({ ...formData, longitude: e.target.value })
                    }
                    placeholder="ex: -4.024429"
                    className="min-h-[48px]"
                    required
                  />
                  <p className="text-xs text-muted-foreground">-180 à 180</p>
                </div>
              </div>

              {/* Radius Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="radius">Rayon de la zone</Label>
                  <Badge variant="secondary">{formData.radiusMeters} mètres</Badge>
                </div>
                <Slider
                  id="radius"
                  value={[formData.radiusMeters]}
                  onValueChange={([value]) =>
                    setFormData({ ...formData, radiusMeters: value })
                  }
                  min={10}
                  max={1000}
                  step={10}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10m</span>
                  <span>1000m</span>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked as boolean })
                    }
                  />
                  <Label htmlFor="active" className="cursor-pointer">
                    Zone active
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="applies-all"
                    checked={formData.appliesToAll}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, appliesToAll: checked as boolean })
                    }
                  />
                  <Label htmlFor="applies-all" className="cursor-pointer">
                    Appliquer à tous les employés
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={
                  !formData.name ||
                  !formData.latitude ||
                  !formData.longitude ||
                  createMutation.isPending
                }
                className="min-h-[44px]"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">
                Chargement des zones...
              </span>
            </div>
          </CardContent>
        </Card>
      ) : !geofences || geofences.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Aucune zone configurée</p>
              <p className="text-sm text-muted-foreground mt-2">
                Créez votre première zone de géorepérage
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Geofences List */
        <div className="space-y-3">
          {geofences.map((geofence) => (
            <Card key={geofence.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{geofence.name}</CardTitle>
                      {geofence.isActive ? (
                        <Badge variant="secondary" className="bg-green-100">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <X className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {geofence.description && (
                      <CardDescription>{geofence.description}</CardDescription>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Dialog
                      open={editingGeofence?.id === geofence.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingGeofence(null);
                          resetForm();
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => handleEdit(geofence)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                          <DialogTitle>Modifier la zone</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-name">Nom *</Label>
                            <Input
                              id="edit-name"
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                              }
                              className="min-h-[48px]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="edit-desc">Description</Label>
                            <Textarea
                              id="edit-desc"
                              value={formData.description}
                              onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                              }
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-lat">Latitude</Label>
                              <Input
                                id="edit-lat"
                                type="number"
                                step="any"
                                value={formData.latitude}
                                onChange={(e) =>
                                  setFormData({ ...formData, latitude: e.target.value })
                                }
                                className="min-h-[48px]"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-lng">Longitude</Label>
                              <Input
                                id="edit-lng"
                                type="number"
                                step="any"
                                value={formData.longitude}
                                onChange={(e) =>
                                  setFormData({ ...formData, longitude: e.target.value })
                                }
                                className="min-h-[48px]"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Rayon</Label>
                              <Badge variant="secondary">
                                {formData.radiusMeters} m
                              </Badge>
                            </div>
                            <Slider
                              value={[formData.radiusMeters]}
                              onValueChange={([value]) =>
                                setFormData({ ...formData, radiusMeters: value })
                              }
                              min={10}
                              max={1000}
                              step={10}
                            />
                          </div>

                          <div className="space-y-3 border-t pt-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-active"
                                checked={formData.isActive}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    isActive: checked as boolean,
                                  })
                                }
                              />
                              <Label htmlFor="edit-active" className="cursor-pointer">
                                Zone active
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-applies-all"
                                checked={formData.appliesToAll}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    appliesToAll: checked as boolean,
                                  })
                                }
                              />
                              <Label
                                htmlFor="edit-applies-all"
                                className="cursor-pointer"
                              >
                                Appliquer à tous les employés
                              </Label>
                            </div>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingGeofence(null);
                              resetForm();
                            }}
                            className="min-h-[44px]"
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            onClick={handleUpdate}
                            disabled={!formData.name || updateMutation.isPending}
                            className="min-h-[44px]"
                          >
                            {updateMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Enregistrer
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-[44px] min-w-[44px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDelete(geofence.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Coordonnées</p>
                    <p className="text-sm font-mono">
                      {geofence.latitude}, {geofence.longitude}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rayon</p>
                    <p className="text-sm font-semibold">
                      {geofence.radiusMeters} mètres
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Portée</p>
                    <p className="text-sm font-semibold">
                      {geofence.appliesToAll
                        ? 'Tous les employés'
                        : `${geofence.employeeAssignments?.length || 0} employé(s)`}
                    </p>
                  </div>
                </div>

                {!geofence.appliesToAll && (
                  <Dialog
                    open={assigningGeofence?.id === geofence.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setAssigningGeofence(null);
                        setSelectedEmployees([]);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full min-h-[44px]"
                        onClick={() => openAssignDialog(geofence)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Gérer les employés assignés
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Assigner des employés</DialogTitle>
                        <DialogDescription>
                          Sélectionner les employés pour cette zone
                        </DialogDescription>
                      </DialogHeader>

                      <div className="max-h-[400px] overflow-y-auto py-4">
                        <div className="space-y-2">
                          {employees.map((emp: any) => (
                            <div
                              key={emp.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                            >
                              <Checkbox
                                id={`emp-${emp.id}`}
                                checked={selectedEmployees.includes(emp.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedEmployees([...selectedEmployees, emp.id]);
                                  } else {
                                    setSelectedEmployees(
                                      selectedEmployees.filter((id) => id !== emp.id)
                                    );
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`emp-${emp.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                {emp.firstName} {emp.lastName}
                                <span className="text-xs text-muted-foreground ml-2">
                                  #{emp.employeeNumber}
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearAssignments}
                          className="min-h-[44px]"
                        >
                          Appliquer à tous
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setAssigningGeofence(null);
                              setSelectedEmployees([]);
                            }}
                            className="min-h-[44px]"
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            onClick={handleAssignEmployees}
                            disabled={
                              selectedEmployees.length === 0 ||
                              assignMutation.isPending
                            }
                            className="min-h-[44px]"
                          >
                            {assignMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Assigner ({selectedEmployees.length})
                          </Button>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
