import piexif from "piexifjs"

export interface GeoMetadata {
  title: string
  subject: string
  latitude: string
  longitude: string
  latRef: "N" | "S"
  lonRef: "E" | "W"
  website: string
  keywords: string
  description: string
  author: string
  websiteName: string
  downloadFormat?: string
}

export const MAX_DESCRIPTION = 1300
export const MAX_KEYWORDS = 6600

/**
 * Encode a string into the UCS-2 (UTF-16LE) byte array that EXIF XP* tags expect.
 * Each byte is returned as a number; the array is null terminated.
 */
function encodeXPString(value: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    bytes.push(code & 0xff)
    bytes.push((code >> 8) & 0xff)
  }
  // Null terminator (2 bytes for UCS-2)
  bytes.push(0, 0)
  return bytes
}

/** Decode a UCS-2 byte array (XP* tag) back into a string. */
function decodeXPString(bytes: number[]): string {
  let out = ""
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8)
    if (code === 0) break
    out += String.fromCharCode(code)
  }
  return out
}

/** Build the EXIF UserComment value (ASCII charset prefix + text). */
function encodeUserComment(value: string): string {
  // 8-byte character code header for ASCII followed by the comment text.
  return "ASCII\0\0\0" + value
}

function decodeBytesToString(value: unknown): string | null {
  if (typeof value === "string") return value

  const tryDecode = (encoding: string, bytes: Uint8Array) => {
    try {
      const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes)
      const cleaned = decoded.replace(/\u0000.*$/, "").trim()
      return cleaned || null
    } catch {
      return null
    }
  }

  if (value instanceof Uint8Array) {
    const bytes = value
    for (const encoding of ["utf-8", "utf-16le", "utf-16be", "latin1"]) {
      const decoded = tryDecode(encoding, bytes)
      if (decoded) return decoded
    }
    return null
  }

  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "number") {
      const bytes = Uint8Array.from(value as number[])
      for (const encoding of ["utf-8", "utf-16le", "utf-16be", "latin1"]) {
        const decoded = tryDecode(encoding, bytes)
        if (decoded) return decoded
      }
      return null
    }
  }

  return null
}

/**
 * Read a File into a base64 data URL.
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Convert any image data URL to a JPEG data URL via canvas.
 * piexifjs can only embed EXIF into JPEG, so PNG/WebP are converted.
 */
export function toJpegDataURL(dataURL: string, quality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }
      // Fill white background so transparent PNGs don't turn black in JPEG.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Could not load image for conversion"))
    img.src = dataURL
  })
}

export function convertDataURLToFormat(
  dataURL: string,
  format: "jpg" | "png" | "webp",
  quality = 0.92,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }
      if (format === "jpg") {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0)

      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg"
      const output = canvas.toDataURL(mime, format === "jpg" ? quality : undefined)
      resolve(output)
    }
    img.onerror = () => reject(new Error("Could not load image for conversion"))
    img.src = dataURL
  })
}

export function buildDownloadFilename(filename: string, format: string) {
  const cleanName = filename.replace(/\.[^/.]+$/, "")
  const ext = format === "png" ? ".png" : format === "webp" ? ".webp" : ".jpg"
  return `${cleanName}${ext}`
}

export interface ExistingGeo {
  latitude: number
  longitude: number
}

export function readExifMetadata(jpegDataURL: string): Partial<GeoMetadata> {
  try {
    const exif = piexif.load(jpegDataURL)
    const zeroth = exif["0th"] as Record<number, unknown>
    const exifIfd = exif.Exif as Record<number, unknown>
    const gps = exif.GPS as Record<number, unknown>

    const metadata: Partial<GeoMetadata> = {}

    const rawTitle = zeroth[piexif.ImageIFD.DocumentName]
    const rawXPTitle = zeroth[piexif.ImageIFD.XPTitle]
    const rawSubject = zeroth[piexif.ImageIFD.XPSubject]
    const rawDescription = zeroth[piexif.ImageIFD.ImageDescription]
    const rawAuthor = zeroth[piexif.ImageIFD.Artist]
    const rawXPAuthor = zeroth[piexif.ImageIFD.XPAuthor]
    const rawWebsiteName = zeroth[piexif.ImageIFD.Copyright]
    const rawKeywords = zeroth[piexif.ImageIFD.XPKeywords]
    const rawWebsite = zeroth[piexif.ImageIFD.XPComment]
    const userComment = exifIfd[piexif.ExifIFD.UserComment]

    const title =
      decodeBytesToString(rawTitle) ||
      (Array.isArray(rawXPTitle) ? decodeXPString(rawXPTitle) : "")
    const subject =
      (Array.isArray(rawSubject) ? decodeXPString(rawSubject) : "") ||
      decodeBytesToString(rawSubject)
    const description = decodeBytesToString(rawDescription)
    const author =
      decodeBytesToString(rawAuthor) ||
      (Array.isArray(rawXPAuthor) ? decodeXPString(rawXPAuthor) : "")
    const websiteName = decodeBytesToString(rawWebsiteName)
    const keywords =
      (Array.isArray(rawKeywords) ? decodeXPString(rawKeywords) : "") ||
      decodeBytesToString(rawKeywords)
    const website =
      ((Array.isArray(rawWebsite) ? decodeXPString(rawWebsite) : "") ||
        decodeBytesToString(rawWebsite) ||
        decodeBytesToString(userComment)?.replace(/^ASCII\x00\x00\x00/, "")) ||
      ""

    if (title?.trim()) metadata.title = title
    if (subject?.trim()) metadata.subject = subject
    if (description?.trim()) metadata.description = description
    if (author?.trim()) metadata.author = author
    if (websiteName?.trim()) metadata.websiteName = websiteName
    if (keywords?.trim()) metadata.keywords = keywords
    if (website?.trim()) metadata.website = website

    const lat = gps[piexif.GPSIFD.GPSLatitude] as [number, number][] | undefined
    const latRef = gps[piexif.GPSIFD.GPSLatitudeRef] as string | undefined
    const lon = gps[piexif.GPSIFD.GPSLongitude] as [number, number][] | undefined
    const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef] as string | undefined

    if (lat && lon && latRef && lonRef) {
      const latitude = piexif.GPSHelper.dmsRationalToDeg(lat, latRef)
      const longitude = piexif.GPSHelper.dmsRationalToDeg(lon, lonRef)
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        metadata.latitude = String(latitude)
        metadata.longitude = String(longitude)
        metadata.latRef = latRef === "S" ? "S" : "N"
        metadata.lonRef = lonRef === "W" ? "W" : "E"
      }
    }

    return metadata
  } catch {
    return {}
  }
}

/**
 * Try to read existing GPS coordinates from a JPEG data URL.
 * Returns null if none are present or the file is not a readable JPEG.
 */
export function readExistingGeo(jpegDataURL: string): ExistingGeo | null {
  try {
    const exif = piexif.load(jpegDataURL)
    const gps = exif.GPS as Record<number, unknown>
    const lat = gps[piexif.GPSIFD.GPSLatitude] as [number, number][] | undefined
    const latRef = gps[piexif.GPSIFD.GPSLatitudeRef] as string | undefined
    const lon = gps[piexif.GPSIFD.GPSLongitude] as [number, number][] | undefined
    const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef] as string | undefined

    if (!lat || !lon || !latRef || !lonRef) return null

    const latitude = piexif.GPSHelper.dmsRationalToDeg(lat, latRef)
    const longitude = piexif.GPSHelper.dmsRationalToDeg(lon, lonRef)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null

    return { latitude, longitude }
  } catch {
    return null
  }
}

/**
 * Embed the provided metadata into a JPEG data URL and return the new
 * JPEG data URL with EXIF written.
 */
export function writeExif(jpegDataURL: string, meta: GeoMetadata): string {
  let exif: ReturnType<typeof piexif.load>
  try {
    exif = piexif.load(jpegDataURL)
  } catch {
    exif = {
      "0th": {},
      Exif: {},
      GPS: {},
      Interop: {},
      "1st": {},
      thumbnail: null,
    }
  }

  const zeroth = exif["0th"] as Record<number, unknown>
  const exifIfd = exif.Exif as Record<number, unknown>
  const gps = exif.GPS as Record<number, unknown>

  if (meta.title) {
    zeroth[piexif.ImageIFD.DocumentName] = meta.title
    zeroth[piexif.ImageIFD.XPTitle] = encodeXPString(meta.title)
  }

  if (meta.subject) {
    zeroth[piexif.ImageIFD.XPSubject] = encodeXPString(meta.subject)
  }

  if (meta.description) {
    zeroth[piexif.ImageIFD.ImageDescription] = meta.description.slice(0, MAX_DESCRIPTION)
  }

  if (meta.author) {
    zeroth[piexif.ImageIFD.Artist] = meta.author
    zeroth[piexif.ImageIFD.XPAuthor] = encodeXPString(meta.author)
  }

  if (meta.websiteName) {
    zeroth[piexif.ImageIFD.Copyright] = meta.websiteName
  }

  if (meta.keywords) {
    zeroth[piexif.ImageIFD.XPKeywords] = encodeXPString(meta.keywords.slice(0, MAX_KEYWORDS))
  }

  if (meta.website) {
    zeroth[piexif.ImageIFD.XPComment] = encodeXPString(meta.website)
    exifIfd[piexif.ExifIFD.UserComment] = encodeUserComment(meta.website)
  }

  zeroth[piexif.ImageIFD.Software] = "Exprintmart GeoTag Tool"

  const lat = Number.parseFloat(meta.latitude)
  const lon = Number.parseFloat(meta.longitude)
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0]
    gps[piexif.GPSIFD.GPSLatitudeRef] = meta.latRef
    gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lat))
    gps[piexif.GPSIFD.GPSLongitudeRef] = meta.lonRef
    gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lon))
  }

  const exifBytes = piexif.dump(exif)
  return piexif.insert(exifBytes, jpegDataURL)
}

/** Convert a data URL into a Blob for downloading. */
export function dataURLtoBlob(dataURL: string): Blob {
  const [header, base64] = dataURL.split(",")
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg"
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/** Trigger a browser download for a data URL. */
export function downloadDataURL(dataURL: string, filename: string) {
  const blob = dataURLtoBlob(dataURL)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { decodeXPString }
