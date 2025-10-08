"use client"

import { useState, useEffect } from "react"
import { MapPin, Navigation, RefreshCw } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  address?: string
}

interface LocationTrackerProps {
  onLocationUpdate: (location: LocationData) => void
  autoTrack?: boolean
}

export function LocationTracker({ onLocationUpdate, autoTrack = false }: LocationTrackerProps) {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geolocationSupported, setGeolocationSupported] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeolocationSupported(false)
      setError("Geolocalización no soportada en este dispositivo")
    }
  }, [])

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocalización no soportada en este dispositivo")
      return
    }

    setIsLoading(true)
    setError(null)

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // Cache por 1 minuto
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options)
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
      }

      // Intentar obtener dirección usando reverse geocoding
      try {
        const address = await reverseGeocode(locationData.latitude, locationData.longitude)
        locationData.address = address
      } catch (geocodeError) {
        console.warn("No se pudo obtener la dirección:", geocodeError)
      }

      setLocation(locationData)
      onLocationUpdate(locationData)
    } catch (error: any) {
      let errorMessage = "Error al obtener ubicación"

      if (error && typeof error === "object" && "code" in error) {
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = "Permisos de ubicación denegados. Permite el acceso en la configuración del navegador."
            break
          case 2: // POSITION_UNAVAILABLE
            errorMessage = "Ubicación no disponible. Verifica tu conexión GPS."
            break
          case 3: // TIMEOUT
            errorMessage = "Tiempo de espera agotado. Intenta nuevamente."
            break
          default:
            errorMessage = "Error desconocido al obtener ubicación"
        }
      } else if (error && error.message) {
        errorMessage = error.message
      }

      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    // Simulación de reverse geocoding - en producción usarías una API real
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`)
      }, 500)
    })
  }

  const formatLocation = (loc: LocationData) => {
    return {
      coordinates: `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`,
      accuracy: `±${Math.round(loc.accuracy)}m`,
      time: new Date(loc.timestamp).toLocaleString("es-GT"),
      address: loc.address || "Dirección no disponible",
    }
  }

  const openInMaps = () => {
    if (location) {
      const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
      window.open(url, "_blank")
    }
  }

  useEffect(() => {
    if (autoTrack && geolocationSupported) {
      getCurrentLocation()
    }
  }, [autoTrack, geolocationSupported])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Ubicación GPS
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={getCurrentLocation} disabled={isLoading || !geolocationSupported} className="flex-1">
            {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Navigation className="w-4 h-4 mr-2" />}
            {isLoading ? "Obteniendo..." : geolocationSupported ? "Obtener Ubicación" : "GPS no disponible"}
          </Button>

          {location && (
            <Button variant="outline" onClick={openInMaps}>
              Ver en Mapa
            </Button>
          )}
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        {location && (
          <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm">
              <strong>Coordenadas:</strong> {formatLocation(location).coordinates}
            </div>
            <div className="text-sm">
              <strong>Precisión:</strong> {formatLocation(location).accuracy}
            </div>
            <div className="text-sm">
              <strong>Hora:</strong> {formatLocation(location).time}
            </div>
            <div className="text-sm">
              <strong>Dirección:</strong> {formatLocation(location).address}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
