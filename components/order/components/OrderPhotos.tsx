"use client"

import { Button } from "@/components/ui/button"
import { X, Camera } from "lucide-react"
import { useState } from "react"

// Aprovecha tus componentes existentes
import { CameraCapture } from "@/components/camera-capture"
import { LocationTracker } from "@/components/location-tracker"

type LocationData = { latitude: number; longitude: number; accuracy: number; timestamp: number; address?: string }

interface OrderPhoto {
  id: string
  dataUrl: string
  timestamp: number
  location?: LocationData
}

interface Props {
  orderPhotos: OrderPhoto[]
  onPhotosChange: (photos: OrderPhoto[]) => void
  onLocationChange: (loc: LocationData | null) => void
}

export function OrderPhotos({ orderPhotos, onPhotosChange, onLocationChange }: Props) {
  const [showCamera, setShowCamera] = useState(false)

  const handleCapture = (dataUrl: string, loc: LocationData | null) => {
    const newPhoto: OrderPhoto = { id: Date.now().toString(), dataUrl, timestamp: Date.now(), location: loc || undefined }
    onPhotosChange([...orderPhotos, newPhoto])
    setShowCamera(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4">
      <div>
        <LocationTracker onLocationUpdate={(loc) => onLocationChange(loc)} autoTrack />
      </div>
      <div>
        <Button type="button" onClick={() => setShowCamera(true)} className="w-full">
          <Camera className="w-4 h-4 mr-2" />
          Tomar Foto
        </Button>

        {showCamera && (
          <CameraCapture
            isOpen={showCamera}
            onClose={() => setShowCamera(false)}
            onPhotoCapture={(dataUrl) => handleCapture(dataUrl, null)}
          />
        )}

        <div className="mt-2">
          {orderPhotos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 sm:gap-2 max-h-24 sm:max-h-32 overflow-y-auto">
              {orderPhotos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img src={photo.dataUrl || "/placeholder.svg"} alt="Foto del pedido" className="w-full h-12 sm:h-16 object-cover rounded border" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onPhotosChange(orderPhotos.filter((p) => p.id !== photo.id))}
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
