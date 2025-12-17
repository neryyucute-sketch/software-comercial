"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Camera, Upload, AlertCircle } from "lucide-react"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Alert, AlertDescription } from "./ui/alert"

interface CameraCaptureProps {
  onPhotoCapture: (photo: string) => void
  isOpen: boolean
  onClose: () => void
}

export function CameraCapture({ onPhotoCapture, isOpen, onClose }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraSupported, setCameraSupported] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkCameraSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraSupported(false)
        setError("La cámara no está disponible en este dispositivo o navegador")
        return false
      }
      return true
    }

    checkCameraSupport()
  }, [])

  const startCamera = async () => {
    try {
      setError(null)
      setIsCapturing(true)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("La API de cámara no está disponible")
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Usar cámara trasera por defecto
          width: { ideal: 1920 }, // 🔒 Seguridad: Limitar resolución
          height: { ideal: 1080 }
        }
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      let errorMessage = "No se pudo acceder a la cámara."

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage =
            "Permisos de cámara denegados. Permite el acceso a la cámara en la configuración del navegador."
        } else if (error.name === "NotFoundError") {
          errorMessage = "No se encontró ninguna cámara en este dispositivo."
        } else if (error.name === "NotSupportedError") {
          errorMessage = "La cámara no es compatible con este navegador."
        } else if (error.message.includes("API")) {
          errorMessage = "La cámara no está disponible. Asegúrate de usar HTTPS."
        }
      }

      setError(errorMessage)
      setIsCapturing(false)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsCapturing(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const context = canvas.getContext("2d")

      // 🔒 Seguridad: Limitar tamaño de imagen
      const maxWidth = 1920;
      const maxHeight = 1080;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      if (context) {
        context.drawImage(video, 0, 0, width, height)
        // 🔒 Seguridad: Calidad reducida para menor tamaño
        const photoDataUrl = canvas.toDataURL("image/jpeg", 0.7)
        setCapturedPhoto(photoDataUrl)
        stopCamera()
      }
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 🔒 Seguridad: Validar tipo y tamaño de archivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        setError('Tipo de archivo no válido. Solo se permiten imágenes JPG, PNG o WebP.');
        return;
      }

      if (file.size > maxSize) {
        setError('El archivo es muy grande. Tamaño máximo: 5MB');
        return;
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setCapturedPhoto(result)
        setError(null) // Limpiar error al subir archivo exitosamente
      }
      reader.onerror = () => {
        setError('Error al leer el archivo');
      }
      reader.readAsDataURL(file)
    }
  }

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onPhotoCapture(capturedPhoto)
      setCapturedPhoto(null)
      setError(null) // Limpiar error al confirmar foto
      onClose()
    }
  }

  const retakePhoto = () => {
    setCapturedPhoto(null)
    setError(null) // Limpiar error al repetir foto
    startCamera()
  }

  const handleClose = () => {
    stopCamera()
    setCapturedPhoto(null)
    setError(null) // Limpiar error al cerrar
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Capturar Foto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isCapturing && !capturedPhoto && (
            <div className="space-y-3">
              <Button onClick={startCamera} className="w-full" disabled={!cameraSupported}>
                <Camera className="w-4 h-4 mr-2" />
                {cameraSupported ? "Abrir Cámara" : "Cámara no disponible"}
              </Button>

              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Subir desde Galería
              </Button>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}

          {isCapturing && (
            <div className="space-y-3">
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
              </div>

              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Capturar
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {capturedPhoto && (
            <div className="space-y-3">
              <div className="relative">
                <img src={capturedPhoto || "/placeholder.svg"} alt="Foto capturada" className="w-full rounded-lg" />
              </div>

              <div className="flex gap-2">
                <Button onClick={confirmPhoto} className="flex-1">
                  Usar Foto
                </Button>
                <Button variant="outline" onClick={retakePhoto}>
                  Repetir
                </Button>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}
