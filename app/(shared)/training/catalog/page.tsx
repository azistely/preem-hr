/**
 * Training Catalog Page
 *
 * Browse available training courses.
 * - All users can view the catalog
 * - HR can create/edit courses
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  BookOpen,
  Clock,
  Users,
  Monitor,
  Building,
  ChevronRight,
  Award,
  AlertTriangle,
} from 'lucide-react';

// Modality icons and labels
const modalityConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  in_person: { icon: Building, label: 'Présentiel' },
  virtual: { icon: Monitor, label: 'En ligne' },
  e_learning: { icon: Monitor, label: 'E-learning' },
  blended: { icon: Monitor, label: 'Mixte' },
  on_the_job: { icon: Users, label: 'Sur le terrain' },
};

export default function TrainingCatalogPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [modalityFilter, setModalityFilter] = useState<string>('all');

  // Fetch courses
  const { data: coursesData, isLoading } = api.training.courses.list.useQuery({
    isActive: true,
    search: search || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    modality:
      modalityFilter !== 'all'
        ? (modalityFilter as 'in_person' | 'virtual' | 'e_learning' | 'blended' | 'on_the_job')
        : undefined,
    limit: 50,
  });

  // Fetch categories for filter
  const { data: categories } = api.training.courses.getCategories.useQuery();

  const courses = coursesData?.data ?? [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Catalogue de formations</h1>
          <p className="text-muted-foreground mt-1">
            Découvrez les formations disponibles
          </p>
        </div>
        <Button
          onClick={() => router.push('/training/requests/new')}
          className="min-h-[48px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Demander une formation
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une formation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 min-h-[48px]"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={modalityFilter} onValueChange={setModalityFilter}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[48px]">
                <SelectValue placeholder="Toutes les modalités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les modalités</SelectItem>
                <SelectItem value="in_person">Présentiel</SelectItem>
                <SelectItem value="virtual">En ligne</SelectItem>
                <SelectItem value="e_learning">E-learning</SelectItem>
                <SelectItem value="blended">Mixte</SelectItem>
                <SelectItem value="on_the_job">Sur le terrain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Course Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune formation trouvée</h3>
            <p className="text-muted-foreground">
              {search || categoryFilter !== 'all' || modalityFilter !== 'all'
                ? 'Essayez de modifier vos filtres de recherche'
                : 'Le catalogue de formations est vide'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const ModalityIcon = modalityConfig[course.modality]?.icon || Monitor;
            const modalityLabel = modalityConfig[course.modality]?.label || course.modality;

            return (
              <Link key={course.id} href={`/training/catalog/${course.id}`}>
                <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold line-clamp-2">{course.name}</h3>
                          {course.isMandatory && (
                            <Badge variant="destructive" className="flex-shrink-0">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Obligatoire
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{course.code}</p>
                      </div>

                      {/* Description */}
                      {course.shortDescription && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {course.shortDescription}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {course.durationHours}h
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <ModalityIcon className="h-3 w-3 mr-1" />
                          {modalityLabel}
                        </Badge>
                        {course.grantsCertification && (
                          <Badge variant="outline" className="text-xs">
                            <Award className="h-3 w-3 mr-1" />
                            Certifiante
                          </Badge>
                        )}
                      </div>

                      {/* Category */}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {course.category}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination info */}
      {coursesData && coursesData.total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {courses.length} sur {coursesData.total} formations
        </p>
      )}
    </div>
  );
}
