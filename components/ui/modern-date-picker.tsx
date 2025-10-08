"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModernDatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  className?: string
}

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export function ModernDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
}: ModernDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) {
      return new Date(value + "T12:00:00")
    }
    return new Date()
  })

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return ""
    const [year, month, day] = dateString.split("-")
    return `${Number.parseInt(day)} de ${MONTHS[Number.parseInt(month) - 1]} de ${year}`
  }

  const formatDateForInput = (year: number, month: number, day: number) => {
    const monthStr = String(month).padStart(2, "0")
    const dayStr = String(day).padStart(2, "0")
    return `${year}-${monthStr}-${dayStr}`
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay()
  }

  const handleDateSelect = (day: number) => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const dateString = formatDateForInput(year, month, day)

    onChange?.(dateString)
    setOpen(false)
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const navigateYear = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setFullYear(prev.getFullYear() - 1)
      } else {
        newDate.setFullYear(prev.getFullYear() + 1)
      }
      return newDate
    })
  }

  const renderCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-10 h-10" />)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = value === formatDateForInput(year, month, day)
      const isToday = new Date().toDateString() === new Date(year, month - 1, day).toDateString()

      days.push(
        <button
          key={day}
          onClick={() => handleDateSelect(day)}
          className={cn(
            "w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-blue-50 hover:text-blue-600",
            isSelected && "bg-blue-600 text-white hover:bg-blue-700",
            isToday && !isSelected && "bg-blue-100 text-blue-600 font-bold",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
          )}
        >
          {day}
        </button>,
      )
    }

    return days
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-11 px-3",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Calendar className="mr-2 h-4 w-4 text-blue-600" />
          {value ? formatDateForDisplay(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-xl border-0 bg-white rounded-xl" align="start">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigateYear("prev")} className="p-1 hover:bg-white/20 rounded-md transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-lg">{currentDate.getFullYear()}</h3>
            <button onClick={() => navigateYear("next")} className="p-1 hover:bg-white/20 rounded-md transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth("prev")}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h4 className="font-medium">{MONTHS[currentDate.getMonth()]}</h4>
            <button
              onClick={() => navigateMonth("next")}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="w-10 h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
        </div>

        <div className="border-t p-3 bg-gray-50 rounded-b-xl">
          <div className="flex justify-between">
            <button
              onClick={() => {
                onChange?.("")
                setOpen(false)
              }}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Limpiar
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const todayString = formatDateForInput(today.getFullYear(), today.getMonth() + 1, today.getDate())
                onChange?.(todayString)
                setOpen(false)
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Hoy
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
