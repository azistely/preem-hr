/**
 * Employee Picker Component
 *
 * Searchable dropdown for selecting one or more employees.
 * Used in forms for assigning evaluators, feedback recipients, etc.
 *
 * HCI Principles:
 * - Type-ahead search for quick finding
 * - Shows avatar + name + matricule
 * - Large touch targets
 */

'use client';

import { forwardRef, useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, User, X, Search } from 'lucide-react';
import { api } from '@/trpc/react';

export interface Employee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
}

export interface EmployeePickerProps {
  /** Field ID */
  id?: string;
  /** Selected employee ID(s) */
  value?: string | string[];
  /** Change handler */
  onChange?: (value: string | string[] | null) => void;
  /** Allow multiple selection */
  multiple?: boolean;
  /** Field label */
  label?: string;
  /** Helper text */
  description?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Is required */
  required?: boolean;
  /** Is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Exclude these employee IDs */
  excludeIds?: string[];
  /** Filter to specific department */
  departmentId?: string;
  /** Filter to specific position */
  positionId?: string;
  /** Additional className */
  className?: string;
}

export const EmployeePicker = forwardRef<HTMLDivElement, EmployeePickerProps>(
  function EmployeePicker(
    {
      id,
      value,
      onChange,
      multiple = false,
      label,
      description,
      placeholder = 'Sélectionner un employé',
      required = false,
      disabled = false,
      error,
      excludeIds = [],
      departmentId,
      positionId,
      className,
    },
    ref
  ) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search for server-side query
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(search);
      }, 300);
      return () => clearTimeout(timer);
    }, [search]);

    // Fetch employees with server-side search and filters
    const { data: employeesData, isLoading } = api.employees.list.useQuery({
      status: 'active',
      search: debouncedSearch || undefined,
      departmentId: departmentId || undefined,
      positionId: positionId || undefined,
      limit: 100,
    });

    const employees = employeesData?.employees ?? [];

    // Filter out excluded IDs (client-side, since it's a small list)
    const filteredEmployees = useMemo(() => {
      return employees.filter((e) => !excludeIds.includes(e.id));
    }, [employees, excludeIds]);

    // Get selected employees
    const selectedIds = multiple
      ? (Array.isArray(value) ? value : value ? [value] : [])
      : value
      ? [value as string]
      : [];

    const selectedEmployees = employees.filter((e) => selectedIds.includes(e.id));

    // Handle selection
    const handleSelect = (employeeId: string) => {
      if (multiple) {
        const currentIds = Array.isArray(value) ? value : value ? [value] : [];
        if (currentIds.includes(employeeId)) {
          // Remove
          const newIds = currentIds.filter((id) => id !== employeeId);
          onChange?.(newIds.length > 0 ? newIds : null);
        } else {
          // Add
          onChange?.([...currentIds, employeeId]);
        }
      } else {
        onChange?.(employeeId);
        setOpen(false);
      }
    };

    // Handle remove (for multiple)
    const handleRemove = (employeeId: string) => {
      if (multiple) {
        const currentIds = Array.isArray(value) ? value : [];
        const newIds = currentIds.filter((id) => id !== employeeId);
        onChange?.(newIds.length > 0 ? newIds : null);
      } else {
        onChange?.(null);
      }
    };

    // Format employee display
    const formatEmployee = (employee: Employee) => {
      return `${employee.firstName} ${employee.lastName}`;
    };

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {label && (
          <Label htmlFor={id} className="text-base font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                'w-full min-h-[48px] justify-between font-normal',
                !value && 'text-muted-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {selectedEmployees.length > 0 ? (
                multiple ? (
                  <span className="text-left truncate">
                    {selectedEmployees.length} employé{selectedEmployees.length !== 1 ? 's' : ''} sélectionné{selectedEmployees.length !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-left truncate flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {formatEmployee(selectedEmployees[0])}
                  </span>
                )
              ) : (
                <span>{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Rechercher par nom ou matricule..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-0 focus-visible:ring-0 h-11"
                />
              </div>
              <CommandList>
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Chargement...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <CommandEmpty>Aucun employé trouvé</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {filteredEmployees.map((employee) => {
                      const isSelected = selectedIds.includes(employee.id);
                      return (
                        <CommandItem
                          key={employee.id}
                          value={employee.id}
                          onSelect={() => handleSelect(employee.id)}
                          className="min-h-[48px] cursor-pointer"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              {employee.avatarUrl ? (
                                <img
                                  src={employee.avatarUrl}
                                  alt=""
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {formatEmployee(employee)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {employee.matricule}
                                {employee.position && ` • ${employee.position}`}
                              </p>
                            </div>
                          </div>
                          <Check
                            className={cn(
                              'ml-2 h-4 w-4',
                              isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selected employees (for multiple) */}
        {multiple && selectedEmployees.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedEmployees.map((employee) => (
              <Badge
                key={employee.id}
                variant="secondary"
                className="px-2 py-1 gap-1"
              >
                <span className="truncate max-w-[150px]">{formatEmployee(employee)}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(employee.id)}
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

export default EmployeePicker;
