/**
 * Public Holidays Management Page (P1-5)
 *
 * Task-oriented design: "Gérer les jours fériés"
 * Following HCI principles:
 * - Zero learning curve (calendar view + simple form)
 * - Smart defaults (current year, country from tenant)
 * - Progressive disclosure (list → create/edit form)
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Check,
  X,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';

const COUNTRIES = [
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
];

export default function PublicHolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedCountry, setSelectedCountry] = useState<string>('CI');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    countryCode: 'CI',
    holidayDate: '',
    nameFr: '',
    nameEn: '',
    descriptionFr: '',
    descriptionEn: '',
    isRecurring: true,
    isPaid: true,
  });

  // Fetch holidays
  const { data: holidays, isLoading, refetch } = trpc.publicHolidays.list.useQuery({
    countryCode: selectedCountry,
    year: selectedYear,
  });

  // Mutations
  const createMutation = trpc.publicHolidays.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = trpc.publicHolidays.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingHoliday(null);
      resetForm();
    },
  });

  const deleteMutation = trpc.publicHolidays.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      countryCode: 'CI',
      holidayDate: '',
      nameFr: '',
      nameEn: '',
      descriptionFr: '',
      descriptionEn: '',
      isRecurring: true,
      isPaid: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate({
      countryCode: formData.countryCode,
      holidayDate: formData.holidayDate,
      name: {
        fr: formData.nameFr,
        en: formData.nameEn || undefined,
      },
      description: formData.descriptionFr || formData.descriptionEn
        ? {
            fr: formData.descriptionFr || undefined,
            en: formData.descriptionEn || undefined,
          }
        : undefined,
      isRecurring: formData.isRecurring,
      isPaid: formData.isPaid,
    });
  };

  const handleUpdate = () => {
    if (!editingHoliday) return;

    updateMutation.mutate({
      id: editingHoliday.id,
      holidayDate: formData.holidayDate,
      name: {
        fr: formData.nameFr,
        en: formData.nameEn || undefined,
      },
      description: formData.descriptionFr || formData.descriptionEn
        ? {
            fr: formData.descriptionFr || undefined,
            en: formData.descriptionEn || undefined,
          }
        : undefined,
      isRecurring: formData.isRecurring,
      isPaid: formData.isPaid,
    });
  };

  const handleEdit = (holiday: any) => {
    setEditingHoliday(holiday);
    setFormData({
      countryCode: holiday.countryCode,
      holidayDate: holiday.holidayDate,
      nameFr: holiday.name?.fr || '',
      nameEn: holiday.name?.en || '',
      descriptionFr: holiday.description?.fr || '',
      descriptionEn: holiday.description?.en || '',
      isRecurring: holiday.isRecurring,
      isPaid: holiday.isPaid,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce jour férié ?')) {
      deleteMutation.mutate({ id });
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jours fériés</h1>
          <p className="text-muted-foreground mt-2">
            Gestion des jours fériés par pays
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="min-h-[48px]">
              <Plus className="mr-2 h-5 w-5" />
              Ajouter un jour férié
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Nouveau jour férié</DialogTitle>
              <DialogDescription>
                Ajouter un jour férié au calendrier
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Country Selection */}
              <div className="space-y-2">
                <Label htmlFor="country">Pays *</Label>
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) =>
                    setFormData({ ...formData, countryCode: value })
                  }
                >
                  <SelectTrigger id="country" className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.holidayDate}
                  onChange={(e) =>
                    setFormData({ ...formData, holidayDate: e.target.value })
                  }
                  className="min-h-[48px]"
                  required
                />
              </div>

              {/* Name (French) */}
              <div className="space-y-2">
                <Label htmlFor="name-fr">Nom (Français) *</Label>
                <Input
                  id="name-fr"
                  value={formData.nameFr}
                  onChange={(e) =>
                    setFormData({ ...formData, nameFr: e.target.value })
                  }
                  placeholder="ex: Jour de l'An"
                  className="min-h-[48px]"
                  required
                />
              </div>

              {/* Name (English) */}
              <div className="space-y-2">
                <Label htmlFor="name-en">Nom (Anglais)</Label>
                <Input
                  id="name-en"
                  value={formData.nameEn}
                  onChange={(e) =>
                    setFormData({ ...formData, nameEn: e.target.value })
                  }
                  placeholder="ex: New Year's Day"
                  className="min-h-[48px]"
                />
              </div>

              {/* Description (French) */}
              <div className="space-y-2">
                <Label htmlFor="desc-fr">Description (Français)</Label>
                <Textarea
                  id="desc-fr"
                  value={formData.descriptionFr}
                  onChange={(e) =>
                    setFormData({ ...formData, descriptionFr: e.target.value })
                  }
                  placeholder="Description optionnelle"
                  rows={2}
                />
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isRecurring: checked as boolean })
                    }
                  />
                  <Label htmlFor="recurring" className="cursor-pointer">
                    Récurrent (chaque année)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paid"
                    checked={formData.isPaid}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isPaid: checked as boolean })
                    }
                  />
                  <Label htmlFor="paid" className="cursor-pointer">
                    Jour férié payé
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
                  !formData.holidayDate ||
                  !formData.nameFr ||
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

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Country Filter */}
        <div className="flex-1">
          <Label htmlFor="filter-country" className="mb-2 block">
            Pays
          </Label>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger id="filter-country" className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year Filter */}
        <div className="flex-1">
          <Label htmlFor="filter-year" className="mb-2 block">
            Année
          </Label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger id="filter-year" className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">
                Chargement des jours fériés...
              </span>
            </div>
          </CardContent>
        </Card>
      ) : !holidays || holidays.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Aucun jour férié</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucun jour férié configuré pour {selectedYear}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Holidays List */
        <div className="space-y-3">
          {holidays.map((holiday) => (
            <Card key={holiday.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">
                        {holiday.name?.fr || 'Sans nom'}
                      </CardTitle>
                    </div>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <span className="font-semibold">
                        {format(parseISO(holiday.holidayDate), 'EEEE d MMMM yyyy', {
                          locale: fr,
                        })}
                      </span>
                      {holiday.isPaid && (
                        <Badge variant="secondary" className="bg-green-100">
                          <Check className="h-3 w-3 mr-1" />
                          Payé
                        </Badge>
                      )}
                      {holiday.isRecurring && (
                        <Badge variant="outline">Récurrent</Badge>
                      )}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Dialog
                      open={editingHoliday?.id === holiday.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingHoliday(null);
                          resetForm();
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => handleEdit(holiday)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                          <DialogTitle>Modifier le jour férié</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          {/* Date */}
                          <div className="space-y-2">
                            <Label htmlFor="edit-date">Date *</Label>
                            <Input
                              id="edit-date"
                              type="date"
                              value={formData.holidayDate}
                              onChange={(e) =>
                                setFormData({ ...formData, holidayDate: e.target.value })
                              }
                              className="min-h-[48px]"
                            />
                          </div>

                          {/* Name (French) */}
                          <div className="space-y-2">
                            <Label htmlFor="edit-name-fr">Nom (Français) *</Label>
                            <Input
                              id="edit-name-fr"
                              value={formData.nameFr}
                              onChange={(e) =>
                                setFormData({ ...formData, nameFr: e.target.value })
                              }
                              className="min-h-[48px]"
                            />
                          </div>

                          {/* Name (English) */}
                          <div className="space-y-2">
                            <Label htmlFor="edit-name-en">Nom (Anglais)</Label>
                            <Input
                              id="edit-name-en"
                              value={formData.nameEn}
                              onChange={(e) =>
                                setFormData({ ...formData, nameEn: e.target.value })
                              }
                              className="min-h-[48px]"
                            />
                          </div>

                          {/* Description (French) */}
                          <div className="space-y-2">
                            <Label htmlFor="edit-desc-fr">Description (Français)</Label>
                            <Textarea
                              id="edit-desc-fr"
                              value={formData.descriptionFr}
                              onChange={(e) =>
                                setFormData({ ...formData, descriptionFr: e.target.value })
                              }
                              rows={2}
                            />
                          </div>

                          {/* Options */}
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-recurring"
                                checked={formData.isRecurring}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    isRecurring: checked as boolean,
                                  })
                                }
                              />
                              <Label htmlFor="edit-recurring" className="cursor-pointer">
                                Récurrent (chaque année)
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-paid"
                                checked={formData.isPaid}
                                onCheckedChange={(checked) =>
                                  setFormData({ ...formData, isPaid: checked as boolean })
                                }
                              />
                              <Label htmlFor="edit-paid" className="cursor-pointer">
                                Jour férié payé
                              </Label>
                            </div>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingHoliday(null);
                              resetForm();
                            }}
                            className="min-h-[44px]"
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            onClick={handleUpdate}
                            disabled={
                              !formData.holidayDate ||
                              !formData.nameFr ||
                              updateMutation.isPending
                            }
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
                      onClick={() => handleDelete(holiday.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {holiday.description?.fr && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {holiday.description.fr}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
