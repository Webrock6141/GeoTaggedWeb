"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { MAX_DESCRIPTION, MAX_KEYWORDS, type GeoMetadata } from "@/lib/exif"

interface MetadataFormProps {
  meta: GeoMetadata & { downloadFormat?: string }
  onChange: (patch: Partial<GeoMetadata & { downloadFormat?: string }>) => void
}

function Toggle({
  options,
  value,
  onChange,
  label,
}: {
  options: [string, string]
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function MetadataForm({ meta, onChange }: MetadataFormProps) {
  const selectedFormat = meta.downloadFormat || "jpg"

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="Image title (EXIF DocumentName)"
          value={meta.title}
          onChange={(e) => onChange({ title: e.target.value })}
           required
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder="Subject of the image (EXIF XPSubject)"
          value={meta.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
           required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="latitude">Latitude</Label>
        <div className="flex gap-2">
          <Input
            id="latitude"
            inputMode="decimal"
            placeholder="25.28109370886218"
            value={meta.latitude}
            onChange={(e) => onChange({ latitude: e.target.value })}
             required
          />
          <Toggle
            label="Latitude direction"
            options={["N", "S"]}
            value={meta.latRef}
            onChange={(v) => onChange({ latRef: v as "N" | "S" })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="longitude">Longitude</Label>
        <div className="flex gap-2">
          <Input
            id="longitude"
            inputMode="decimal"
            placeholder="55.39210784750408"
            value={meta.longitude}
            onChange={(e) => onChange({ longitude: e.target.value })}
            required
          />
          <Toggle
            label="Longitude direction"
            options={["E", "W"]}
            value={meta.lonRef}
            onChange={(v) => onChange({ lonRef: v as "E" | "W" })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="website">Website Link</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://exprintmart.com/page"
          value={meta.website}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="keywords">Keywords</Label>
          <span
            className={cn(
              "text-xs",
              meta.keywords.length > MAX_KEYWORDS ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {meta.keywords.length}/{MAX_KEYWORDS}
          </span>
        </div>
        <Textarea
          id="keywords"
          rows={2}
          placeholder="geotag, photography, travel, exprintmart"
          value={meta.keywords}
          onChange={(e) => onChange({ keywords: e.target.value.slice(0, MAX_KEYWORDS) })}
           required
        />
        <p className="text-xs text-muted-foreground">Comma-separated (EXIF XPKeywords)</p>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Description / Alt Text</Label>
          <span
            className={cn(
              "text-xs",
              meta.description.length > MAX_DESCRIPTION
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {meta.description.length}/{MAX_DESCRIPTION}
            
          </span>
        </div>
        <Textarea
          id="description"
          rows={4}
          placeholder="Describe the image for accessibility and SEO (EXIF ImageDescription)"
          value={meta.description}
          onChange={(e) =>
            onChange({ description: e.target.value.slice(0, MAX_DESCRIPTION) })
          }
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="author">Author</Label>
        <Input
          id="author"
          placeholder="Photographer / creator (EXIF Artist)"
          value={meta.author}
          onChange={(e) => onChange({ author: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="websiteName">Copyright</Label>
        <Input
          id="websiteName"
          placeholder="Exprintmart"
          value={meta.websiteName}
          onChange={(e) => onChange({ websiteName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Stored in EXIF Copyright</p>
      </div>

      {/* Dropdown Field */}
      <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
        <Label htmlFor="downloadFormat" className="font-semibold text-foreground">
          Download File Format
        </Label>
        <select
          id="downloadFormat"
          value={selectedFormat}
          onChange={(e) => onChange({ downloadFormat: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <option value="jpg">JPG (.jpg)</option>
          <option value="webp">WebP (.webp)</option>
          <option value="png">PNG (.png)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Choose your preferred final format output when downloading files.
        </p>
      </div>
    </div>
  )
}