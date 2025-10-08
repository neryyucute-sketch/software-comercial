"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date | string
  onDateChange?: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  // Convertir date a Date object si es string
  const dateObj = date ? (typeof date === "string" ? new Date(date + "T12:00:00") : date) : undefined
  const [currentMonth, setCurrentMonth] = useState(dateObj || new Date())

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onDateChange?.("")
      setOpen(false)
      return
    }

    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const day = String(selectedDate.getDate()).padStart(2, "0")
    const dateString = `${year}-${month}-${day}`

    onDateChange?.(dateString)
    setOpen(false)
  }

  // Generar lista de meses para navegación lateral
  const generateMonthList = () => {
    const months = []
    const currentYear = new Date().getFullYear()
    const startDate = new Date(currentYear - 1, 0) // Empezar desde enero del año anterior

    for (let i = 0; i < 36; i++) {
      // 3 años de meses
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i)
      months.push(monthDate)
    }
    return months
  }

  const monthList = generateMonthList()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-12 text-base",
            !dateObj && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-3 h-5 w-5" />
          {dateObj ? format(dateObj, "PPP", { locale: es }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex" align="start">
        {/* Navegación lateral de meses */}
        <div className="w-32 border-r bg-muted/20">
          <div className="p-2 border-b">
            <p className="text-sm font-medium text-center">Meses</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {monthList.map((monthDate, index) => {
              const isSelected =
                monthDate.getMonth() === currentMonth.getMonth() &&
                monthDate.getFullYear() === currentMonth.getFullYear()

              return (
                <button
                  key={index}
                  onClick={() => setCurrentMonth(monthDate)}
                  className={cn(
                    "w-full px-3 py-2 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    isSelected && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(monthDate, "MMM-yy", { locale: es })}
                </button>
              )
            })}
          </div>
        </div>

        {/* Calendario principal */}
        <div className="p-3">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleDateSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            initialFocus
            locale={es}
            className="rounded-md"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-medium",
              nav: "space-x-1 flex items-center",
              nav_button: cn("h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-12 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: cn(
                "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
                "h-12 w-12", // Celdas más grandes para facilitar selección táctil
              ),
              day: cn(
                "h-12 w-12 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
              ),
              day_range_end: "day-range-end",
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside:
                "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
              IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
