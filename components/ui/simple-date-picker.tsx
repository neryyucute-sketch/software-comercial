"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SimpleDatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

export function SimpleDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
}: SimpleDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleButtonClick = () => {
    setIsOpen(true)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value
    onChange?.(selectedDate)
    setIsOpen(false)
  }

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return placeholder

    const [year, month, day] = dateString.split("-")
    const months = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ]

    return `${Number.parseInt(day)} de ${months[Number.parseInt(month) - 1]} de ${year}`
  }

  return (
    <div className="relative">
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          className={cn(
            "w-full justify-start text-left font-normal h-12",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {formatDisplayDate(value || "")}
        </Button>
      ) : (
        <input
          ref={inputRef}
          type="date"
          value={value || ""}
          onChange={handleDateChange}
          onBlur={() => setIsOpen(false)}
          className={cn(
            "w-full h-12 px-3 py-2 border border-input bg-background rounded-md text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className,
          )}
        />
      )}
    </div>
  )
}
