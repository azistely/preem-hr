/**
 * Enhanced Date Picker Component
 *
 * Features:
 * - Year/month dropdown navigation for easy selection
 * - Manual date input with DD/MM/YYYY format
 * - Calendar widget for visual selection
 * - French localization
 */

'use client'

import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, parse, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  id?: string
  value?: Date | null
  onChange?: (date: Date | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean | ((date: Date) => boolean)
  fromYear?: number
  toYear?: number
  allowManualInput?: boolean
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  className,
  disabled = false,
  fromYear = 1940,
  toYear = new Date().getFullYear(),
  allowManualInput = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')
  const [inputError, setInputError] = React.useState(false)

  // Update input value when date changes
  React.useEffect(() => {
    if (value) {
      setInputValue(format(value, 'dd/MM/yyyy'))
      setInputError(false)
    } else {
      setInputValue('')
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value
    setInputValue(inputVal)

    // Try to parse the input as DD/MM/YYYY
    if (inputVal.length === 10) {
      const parsedDate = parse(inputVal, 'dd/MM/yyyy', new Date())

      if (isValid(parsedDate)) {
        // Check if date passes disabled check
        if (typeof disabled === 'function' && disabled(parsedDate)) {
          setInputError(true)
          return
        }

        setInputError(false)
        onChange?.(parsedDate)
      } else {
        setInputError(true)
      }
    } else {
      setInputError(false)
    }
  }

  const handleInputBlur = () => {
    // If input is invalid or empty, reset to current date value
    if (inputError || !inputValue) {
      if (value) {
        setInputValue(format(value, 'dd/MM/yyyy'))
      } else {
        setInputValue('')
      }
      setInputError(false)
    }
  }

  const isDisabledBoolean = typeof disabled === 'boolean' ? disabled : false

  return (
    <div className="flex gap-2 items-start">
      {allowManualInput && (
        <div className="flex-1">
          <Input
            id={id}
            type="text"
            placeholder="JJ/MM/AAAA"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={isDisabledBoolean}
            className={cn(
              'min-h-[48px]',
              inputError && 'border-destructive focus-visible:ring-destructive'
            )}
          />
          {inputError && (
            <p className="text-xs text-destructive mt-1">
              Format invalide. Utilisez JJ/MM/AAAA
            </p>
          )}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {allowManualInput ? (
            <Button
              variant="outline"
              disabled={isDisabledBoolean}
              className="min-h-[48px] px-3"
              aria-label="Ouvrir le calendrier"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              id={id}
              variant="outline"
              disabled={isDisabledBoolean}
              className={cn(
                'min-h-[48px] w-full pl-3 text-left font-normal',
                !value && 'text-muted-foreground',
                className
              )}
            >
              {value ? format(value, 'PPP', { locale: fr }) : <span>{placeholder}</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(date) => {
              onChange?.(date ?? null)
              setOpen(false)
            }}
            disabled={typeof disabled === 'function' ? disabled : undefined}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            locale={fr}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
