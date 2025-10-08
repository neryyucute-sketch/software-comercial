"use client"

import { useState, useCallback } from "react"

interface DeviceCapabilities {
  hasCamera: boolean
  hasGeolocation: boolean
  isOnline: boolean
  isPWA: boolean
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  address?: string
}

export function useDeviceFeatures() {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    hasCamera: false,
    hasGeolocation: false,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : false,
    isPWA: false,
  })

  const checkCapabilities = useCallback(async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return capabilities
    }

    const caps: DeviceCapabilities = {
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasGeolocation: !!navigator.geolocation,
      isOnline: navigator.onLine,
      isPWA:
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://"),
    }

    setCapabilities(caps)
    return caps
  }, [capabilities])

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("Camera API not supported")
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop()) // Detener inmediatamente
      return true
    } catch (error) {
      console.error("Camera permission denied:", error)
      return false
    }
  }, [])

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("Geolocation API not supported")
        resolve(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (error) => {
          console.error("Location permission denied:", error)
          resolve(false)
        },
        { timeout: 5000 },
      )
    })
  }, [])

  const capturePhoto = useCallback(async (): Promise<string | null> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("Camera API not supported")
      return null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      return new Promise((resolve) => {
        const video = document.createElement("video")
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        video.srcObject = stream
        video.play()

        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          setTimeout(() => {
            if (context) {
              context.drawImage(video, 0, 0)
              const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
              stream.getTracks().forEach((track) => track.stop())
              resolve(dataUrl)
            } else {
              stream.getTracks().forEach((track) => track.stop())
              resolve(null)
            }
          }, 1000) // Esperar 1 segundo para que se estabilice la imagen
        }

        video.onerror = () => {
          stream.getTracks().forEach((track) => track.stop())
          resolve(null)
        }
      })
    } catch (error) {
      console.error("Error capturing photo:", error)
      return null
    }
  }, [])

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (!navigator.geolocation) {
      console.warn("Geolocation API not supported")
      return null
    }

    return new Promise((resolve, reject) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          })
        },
        (error) => {
          console.error("Geolocation error:", error)
          reject(error)
        },
        options,
      )
    })
  }, [])

  const shareContent = useCallback(async (data: ShareData): Promise<boolean> => {
    if (!navigator.share) {
      console.warn("Web Share API not supported")
      return false
    }

    try {
      await navigator.share(data)
      return true
    } catch (error) {
      console.error("Error sharing:", error)
      return false
    }
  }, [])

  const installPWA = useCallback(() => {
    // Esta función se puede usar con el evento beforeinstallprompt
    const event = (window as any).deferredPrompt
    if (event) {
      event.prompt()
      event.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          console.log("PWA installed")
        }
        ;(window as any).deferredPrompt = null
      })
    } else {
      console.warn("PWA installation prompt not available")
    }
  }, [])

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!navigator.vibrate) {
      console.warn("Vibration API not supported")
      return false
    }

    try {
      navigator.vibrate(pattern)
      return true
    } catch (error) {
      console.error("Error with vibration:", error)
      return false
    }
  }, [])

  return {
    capabilities,
    checkCapabilities,
    requestCameraPermission,
    requestLocationPermission,
    capturePhoto,
    getCurrentLocation,
    shareContent,
    installPWA,
    vibrate,
  }
}
