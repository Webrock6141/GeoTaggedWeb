"use client"

import { useCallback, useMemo, useState } from "react"
import { Download, Trash2, Loader2, Tags } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UploadPanel } from "@/components/upload-panel"
import { MetadataForm } from "@/components/metadata-form"
import { MapPreview } from "@/components/map-preview"
import {
  readFileAsDataURL,
  toJpegDataURL,
  readExistingGeo,
  writeExif,
  downloadDataURL,
  type GeoMetadata,
} from "@/lib/exif"

export interface ImageItem {
  id: string
  file: File
  name: string
  size: number
  dataURL: string
  isJpeg: boolean
  existingGeo: { latitude: number; longitude: number } | null
  processed: boolean
}

export interface DownloadHistoryItem {
  id: string
  fileName: string
  timestamp: string
}

const EMPTY_META: GeoMetadata = {
  title: "",
  subject: "",
  latitude: "",
  longitude: "",
  latRef: "N",
  lonRef: "E",
  website: "",
  keywords: "",
  description: "",
  author: "",
  websiteName: "Exprintmart",
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

export function GeoTagTool() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [meta, setMeta] = useState<GeoMetadata>(EMPTY_META)
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"download" | "history">("download")

  const updateMeta = useCallback((patch: Partial<GeoMetadata>) => {
    setMeta((prev) => ({ ...prev, ...patch }))
  }, [])

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => ACCEPTED.includes(f.type))
    if (files.length === 0) {
      setStatus("Only JPG, PNG and WebP images are supported.")
      return
    }

    let prefill: { latitude: number; longitude: number } | null = null

    const items = await Promise.all(
      files.map(async (file) => {
        const dataURL = await readFileAsDataURL(file)
        const isJpeg = file.type === "image/jpeg"
        let existingGeo: { latitude: number; longitude: number } | null = null
        if (isJpeg) {
          existingGeo = readExistingGeo(dataURL)
          if (existingGeo && !prefill) prefill = existingGeo
        }
        return {
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          name: file.name,
          size: file.size,
          dataURL,
          isJpeg,
          existingGeo,
          processed: false,
        } satisfies ImageItem
      }),
    )

    setImages((prev) => [...prev, ...items])
    setStatus(null)

    // Pre-fill coordinates from the first image that already has a geotag.
    if (prefill) {
      const geo = prefill as { latitude: number; longitude: number }
      setMeta((prev) => {
        if (prev.latitude || prev.longitude) return prev
        return {
          ...prev,
          latitude: Math.abs(geo.latitude).toFixed(6),
          longitude: Math.abs(geo.longitude).toFixed(6),
          latRef: geo.latitude >= 0 ? "N" : "S",
          lonRef: geo.longitude >= 0 ? "E" : "W",
        }
      })
    }
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setImages([])
    setMeta(EMPTY_META)
    setStatus(null)
  }, [])

  const { mapLat, mapLon } = useMemo(() => {
    const lat = Number.parseFloat(meta.latitude)
    const lon = Number.parseFloat(meta.longitude)
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return { mapLat: null, mapLon: null }
    }
    return {
      mapLat: meta.latRef === "S" ? -Math.abs(lat) : Math.abs(lat),
      mapLon: meta.lonRef === "W" ? -Math.abs(lon) : Math.abs(lon),
    }
  }, [meta.latitude, meta.longitude, meta.latRef, meta.lonRef])

  const processAll = useCallback(async () => {
    if (images.length === 0) {
      setStatus("Upload at least one image first.")
      return
    }
    setProcessing(true)
    setStatus(null)
    try {
      let count = 0
      for (const img of images) {
        const jpegSource = img.isJpeg ? img.dataURL : await toJpegDataURL(img.dataURL)
        const tagged = writeExif(jpegSource, meta)
        const baseName = img.name.replace(/\.[^.]+$/, "")
        const outputName = `${baseName}.webp`
        downloadDataURL(tagged, outputName)

        setDownloadHistory((prev) => {
          const entry: DownloadHistoryItem = {
            id: `${img.id}-${Date.now()}-${count}`,
            fileName: outputName,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }
          return [entry, ...prev].slice(0, 5)
        })

        count++
        // Small delay so the browser registers each download separately.
        await new Promise((r) => setTimeout(r, 350))
      }
      setImages((prev) => prev.map((img) => ({ ...img, processed: true })))
      setStatus(`Done! ${count} image${count > 1 ? "s" : ""} tagged and downloaded.`)
    } catch (err) {
      console.log("[v0] EXIF processing error:", err)
      setStatus("Something went wrong while writing EXIF data. Please try again.")
    } finally {
      setProcessing(false)
    }
  }, [images, meta])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: upload + thumbnails */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Upload Images</CardTitle>
            <CardDescription>
              Add one or many photos. The same metadata is applied to all of them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadPanel images={images} onAddFiles={addFiles} onRemove={removeImage} />
          </CardContent>
        </Card>

        {/* Right: metadata form */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              Fill in the EXIF fields to embed into every uploaded image.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetadataForm meta={meta} onChange={updateMeta} />
          </CardContent>
        </Card>
      </div>

      {/* Map preview */}
      <Card>
        <CardHeader>
          <CardTitle>Location Preview</CardTitle>
          <CardDescription>
            Live map pin updates as you type latitude and longitude.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MapPreview lat={mapLat} lon={mapLon} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        {status && (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-sm text-muted-foreground"
          >
            {status}
          </p>
        )}

        <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 p-1">
          <Button
            type="button"
            variant={activeTab === "download" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("download")}
          >
            Download
          </Button>
          <Button
            type="button"
            variant={activeTab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("history")}
          >
            History
          </Button>
        </div>

        {activeTab === "download" ? (
          <>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                type="button"
                size="lg"
                onClick={processAll}
                disabled={processing || images.length === 0}
                className="font-semibold"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-5 w-5" aria-hidden="true" />
                )}
                {processing
                  ? "Writing EXIF…"
                  : `Write EXIF Tags & Download All${images.length ? ` (${images.length})` : ""}`}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={clearAll}
                disabled={processing}
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                Clear All
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tags className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Non-JPEG images are converted to JPEG so EXIF can be embedded.
            </p>
          </>
        ) : (
          <div className="w-full rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Downloads</h3>
              <span className="text-xs text-muted-foreground">Last 5</span>
            </div>
            {downloadHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No downloads yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {downloadHistory.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${item.fileName}`}
                      onClick={() =>
                        setDownloadHistory((prev) =>
                          prev.filter((entry) => entry.id !== item.id),
                        )
                      }
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
