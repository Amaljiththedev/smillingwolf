"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  ANIMATIONS,
  BLOCK_STYLE,
  canHide,
  definitionFor,
  emptyItem,
  fieldApplies,
  hiddenKeys,
  readAnimation,
  readItems,
  readList,
  readMedia,
  readStyle,
  readText,
  safeUrl,
  type BlockStyle,
  type Field,
  type Media,
  type SubField,
} from "@/lib/blocks";
import { ACCENTS } from "@/lib/editor";
import { FONT_LABELS, THEMES, themeById, themeStyle, type Theme } from "@/lib/themes";
import type { Block } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The inspector. Fields come from the block registry, so a new block type
  gets an editing panel without any work here.
*/

const control =
  "w-full rounded-sw border border-ink/15 bg-white px-2.5 py-1.5 text-[0.85rem] text-ink transition-colors duration-150 focus:border-ink/40 focus:outline-none focus:ring-1 focus:ring-ink/30";

const smallButton =
  "inline-flex items-center gap-1.5 rounded-sw border border-ink/15 px-2 py-1 text-[0.78rem] text-ink/75 transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50";

const iconButton =
  "grid size-7 shrink-0 place-items-center rounded-[3px] text-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-30";

function Help({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[0.72rem] leading-snug text-ink/50">{children}</p>;
}

/* ---------- Lists ---------- */

function ListField({
  field,
  values,
  onChange,
}: {
  field: Extract<Field, { type: "list" }>;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input
            value={value}
            aria-label={`${field.itemLabel} ${index + 1}`}
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              onChange(next);
            }}
            className={control}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, position) => position !== index))}
            aria-label={`Remove ${field.itemLabel.toLowerCase()} ${index + 1}`}
            className={iconButton}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, `${field.itemLabel} ${values.length + 1}`])}
        className={cn(smallButton, "self-start")}
      >
        <Plus className="size-3" aria-hidden="true" />
        Add {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

/* ---------- Images and files ---------- */

type Uploaded = { url: string; size: number; name: string };

const MAX_EDGE = 2400;

/**
 * Shrinks big photos before they leave the browser. CGIs straight from a
 * renderer are often 5-20 MB, which is slow for visitors and makes WordPress
 * time out while it builds thumbnails. Long edge is capped at 2400px; the
 * result is a JPEG unless the image has transparency (logos stay PNG).
 * GIFs are left alone so animations survive.
 */
async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_000_000) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let transparent = false;
  if (file.type !== "image/jpeg") {
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        transparent = true;
        break;
      }
    }
  }

  const type = transparent ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;
  const name = file.name.replace(/\.[^.]*$/, "") + (transparent ? ".png" : ".jpg");
  return new File([blob], name, { type });
}

async function upload(siteId: string, original: File): Promise<Uploaded> {
  const file = await prepareImage(original);
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`/builder/${encodeURIComponent(siteId)}/media`, { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as Partial<Uploaded> & { error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? "The upload failed.");
  return { url: data.url, size: data.size ?? file.size, name: data.name ?? file.name };
}

function fileLabel(media: Media): string {
  if (media.name) return media.name;
  try {
    return decodeURIComponent(new URL(media.url).pathname.split("/").pop() ?? "") || media.url;
  } catch {
    return media.url;
  }
}

function MediaField({
  kind,
  value,
  onChange,
  siteId,
  label,
}: {
  kind: "image" | "file";
  value: Media;
  onChange: (next: Media) => void;
  siteId: string;
  label: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const src = safeUrl(value.url);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await upload(siteId, file);
      onChange({
        url: result.url,
        /* Start the alt text from the file name so it is never blank; the user should improve it. */
        alt: value.alt || (kind === "image" ? "" : result.name),
        name: result.name,
        size: result.size,
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void send(event.dataTransfer.files[0]);
        }}
        className={cn(
          "relative overflow-hidden rounded-lg border border-dashed transition-colors",
          dragOver ? "border-ink bg-lime/30" : "border-ink/20 bg-paper/60",
        )}
      >
        {src && kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="aspect-[16/10] w-full object-cover" />
        ) : src ? (
          <div className="flex items-center gap-2.5 px-3 py-3">
            <FileText className="size-4 shrink-0 text-ink/60" aria-hidden="true" />
            <span className="min-w-0 truncate text-[0.8rem] text-ink">{fileLabel(value)}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1 px-3 py-5 text-center focus-visible:outline-2 focus-visible:outline-ink"
          >
            <Upload className="size-4 text-ink/50" aria-hidden="true" />
            <span className="text-[0.78rem] text-ink/70">Drop {kind === "image" ? "an image" : "a PDF"} here or choose a file</span>
            <span className="text-[0.68rem] text-ink/45">{kind === "image" ? "JPG, PNG, WebP or GIF, up to 8 MB" : "PDF, up to 20 MB"}</span>
          </button>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/75">
            <span className="inline-flex items-center gap-2 text-[0.78rem] text-ink">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Uploading
            </span>
          </div>
        )}
      </div>

      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "application/pdf"}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Upload ${label.toLowerCase()}`}
        onChange={(event) => void send(event.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-1.5">
        {src && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={smallButton}>
            <Upload className="size-3" aria-hidden="true" />
            Replace
          </button>
        )}
        <button type="button" onClick={() => setLinking((open) => !open)} aria-expanded={linking} className={smallButton}>
          <Link2 className="size-3" aria-hidden="true" />
          {linking ? "Hide link" : "Use a link"}
        </button>
        {src && (
          <button type="button" onClick={() => onChange({ url: "", alt: "" })} className={smallButton}>
            <X className="size-3" aria-hidden="true" />
            Remove
          </button>
        )}
      </div>

      {linking && (
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={value.url}
          aria-label={`${label} link`}
          onChange={(event) => onChange({ ...value, url: event.target.value, name: undefined, size: undefined })}
          className={control}
        />
      )}

      {kind === "image" && src && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-alt`} className="text-[0.72rem] text-ink/60">
            Alt text
          </label>
          <input
            id={`${id}-alt`}
            value={value.alt}
            placeholder="What the image shows"
            onChange={(event) => onChange({ ...value, alt: event.target.value })}
            aria-invalid={!value.alt.trim()}
            className={cn(control, !value.alt.trim() && "border-coral")}
          />
          {!value.alt.trim() && (
            <p className="text-[0.7rem] leading-snug text-ink/70">Needed for screen readers. Describe what the image shows.</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-sw bg-coral/25 px-2.5 py-1.5 text-[0.74rem] leading-snug text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Repeatable items ---------- */

function SubFieldInput({
  sub,
  item,
  siteId,
  onChange,
}: {
  sub: SubField;
  item: Record<string, unknown>;
  siteId: string;
  onChange: (value: unknown) => void;
}) {
  const id = useId();
  if (sub.type === "image" || sub.type === "file") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] text-ink/60">{sub.label}</span>
        <MediaField kind={sub.type} value={readMedia(item, sub.key)} onChange={onChange} siteId={siteId} label={sub.label} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[0.72rem] text-ink/60">
        {sub.label}
      </label>
      {sub.type === "textarea" ? (
        <textarea id={id} rows={3} value={readText(item, sub.key)} onChange={(event) => onChange(event.target.value)} className={cn(control, "resize-y leading-snug")} />
      ) : (
        <input id={id} value={readText(item, sub.key)} onChange={(event) => onChange(event.target.value)} className={control} />
      )}
    </div>
  );
}

function ItemsField({
  field,
  items,
  siteId,
  onChange,
}: {
  field: Extract<Field, { type: "items" }>;
  items: Record<string, unknown>[];
  siteId: string;
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const full = field.max !== undefined && items.length >= field.max;

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setOpen(open === from ? to : open);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, index) => {
        const expanded = open === index;
        const title = readText(item, field.titleKey) || `${field.itemLabel} ${index + 1}`;
        const thumb = field.fields.find((sub) => sub.type === "image");
        const thumbUrl = thumb ? safeUrl(readMedia(item, thumb.key).url) : "";
        return (
          <div key={index} className={cn("rounded-lg border transition-colors", expanded ? "border-ink/25 bg-white" : "border-ink/12 bg-white")}>
            <div className="flex items-center gap-1 pr-1">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-l-lg px-2.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-ink"
              >
                {thumb && (
                  thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt="" className="size-6 shrink-0 rounded-[3px] object-cover" />
                  ) : (
                    <span aria-hidden="true" className="size-6 shrink-0 rounded-[3px] bg-ink/[0.06]" />
                  )
                )}
                <span className="min-w-0 flex-1 truncate text-[0.82rem] text-ink">{title}</span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-ink/45 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${title} up`} className={iconButton}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(index, index + 1)} disabled={index === items.length - 1} aria-label={`Move ${title} down`} className={iconButton}>
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(items.filter((_, position) => position !== index));
                  setOpen(null);
                }}
                aria-label={`Remove ${title}`}
                className={iconButton}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            {expanded && (
              <div className="flex flex-col gap-3 border-t border-ink/10 px-2.5 py-3">
                {field.fields.map((sub) => (
                  <SubFieldInput
                    key={sub.key}
                    sub={sub}
                    item={item}
                    siteId={siteId}
                    onChange={(value) => onChange(items.map((current, position) => (position === index ? { ...current, [sub.key]: value } : current)))}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        disabled={full}
        onClick={() => {
          onChange([...items, emptyItem(field, items.length)]);
          setOpen(items.length);
        }}
        className={cn(smallButton, "self-start")}
      >
        <Plus className="size-3" aria-hidden="true" />
        {full ? `Up to ${field.max} ${field.itemLabel.toLowerCase()}s` : `Add ${field.itemLabel.toLowerCase()}`}
      </button>
    </div>
  );
}

/* ---------- Choices ---------- */

/** A row of buttons for a few short options: quicker to scan than a dropdown. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-sw border border-ink/15 bg-paper/60 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 flex-1 truncate rounded-[3px] px-1.5 py-1 text-[0.76rem] transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-ink",
              active ? "bg-white font-medium text-ink shadow-[0_1px_3px_rgba(19,23,19,0.15)]" : "text-ink/60 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Style (every block) ---------- */

function StyleFields({ block, accent, onUpdate }: { block: Block; accent: string; onUpdate: (key: string, value: unknown) => void }) {
  const style = readStyle(block.props);
  const set = (patch: Partial<BlockStyle>) => onUpdate("style", { ...style, ...patch });
  const swatch: Record<BlockStyle["background"], string> = {
    none: "#ffffff",
    paper: "#f7f3f0",
    tint: `color-mix(in srgb, ${accent} 26%, white)`,
  };

  return (
    <div className="flex flex-col gap-3.5 border-t border-ink/10 pt-4">
      <p className="text-[0.75rem] font-medium text-ink/70">Style</p>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] text-ink/60">Background</span>
        <div role="radiogroup" aria-label="Background" className="flex gap-1.5">
          {BLOCK_STYLE.background.map((option) => {
            const active = style.background === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ background: option.value })}
                className={cn(
                  "flex flex-1 items-center gap-1.5 rounded-sw border px-2 py-1.5 text-[0.74rem] transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-ink",
                  active ? "border-ink text-ink" : "border-ink/15 text-ink/65 hover:border-ink/35",
                )}
              >
                <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border border-ink/15" style={{ background: swatch[option.value] }} />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] text-ink/60">Spacing</span>
        <Segmented label="Spacing" value={style.spacing} options={BLOCK_STYLE.spacing} onChange={(value) => set({ spacing: value as BlockStyle["spacing"] })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] text-ink/60">Text alignment</span>
        <Segmented label="Text alignment" value={style.align} options={BLOCK_STYLE.align} onChange={(value) => set({ align: value as BlockStyle["align"] })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] text-ink/60">Show on</span>
        <div className="flex gap-1.5">
          {BLOCK_STYLE.devices.map((device) => {
            const shown = !style.hideOn.includes(device.value);
            return (
              <button
                key={device.value}
                type="button"
                aria-pressed={shown}
                onClick={() =>
                  set({ hideOn: shown ? [...style.hideOn, device.value] : style.hideOn.filter((d) => d !== device.value) })
                }
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1 rounded-sw border px-2 py-1 text-[0.74rem] transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-ink",
                  shown ? "border-ink/25 bg-white text-ink" : "border-dashed border-ink/20 text-ink/40 line-through",
                )}
              >
                {device.label}
              </button>
            );
          })}
        </div>
        <Help>Hidden blocks are faded here and left out of the page on that device.</Help>
      </div>
    </div>
  );
}

/* ---------- The panel ---------- */

function BlockFields({
  block,
  accent,
  siteId,
  onUpdate,
}: {
  block: Block;
  accent: string;
  siteId: string;
  onUpdate: (key: string, value: unknown) => void;
}) {
  const id = useId();
  const definition = definitionFor(block.kind);
  const hidden = hiddenKeys(block.props);

  return (
    <>
      {definition.fields.filter((field) => fieldApplies(field, block.props, definition.defaults)).map((field) => {
        const fieldId = `${id}-${field.key}`;
        const grouped = field.type === "list" || field.type === "items" || field.type === "image" || field.type === "choice";
        const isHidden = hidden.includes(field.key);
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              {grouped ? (
                <p className={cn("text-[0.75rem] font-medium", isHidden ? "text-ink/40" : "text-ink/70")}>{field.label}</p>
              ) : (
                <label htmlFor={fieldId} className={cn("text-[0.75rem] font-medium", isHidden ? "text-ink/40" : "text-ink/70")}>
                  {field.label}
                </label>
              )}
              {canHide(field) && (
                <button
                  type="button"
                  onClick={() => onUpdate("hidden", isHidden ? hidden.filter((key) => key !== field.key) : [...hidden, field.key])}
                  aria-pressed={!isHidden}
                  aria-label={isHidden ? `Show ${field.label.toLowerCase()} on the page` : `Hide ${field.label.toLowerCase()} from the page`}
                  title={isHidden ? "Hidden on the page. Click to show." : "Shown on the page. Click to hide."}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-[0.66rem] transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-ink",
                    isHidden ? "bg-ink/[0.06] text-ink/60 hover:text-ink" : "text-ink/35 hover:bg-ink/5 hover:text-ink",
                  )}
                >
                  {isHidden ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                  {isHidden && "Hidden"}
                </button>
              )}
            </div>

            <div className={cn("flex flex-col gap-1.5", isHidden && "opacity-45")}>

            {(field.type === "text" || field.type === "url" || field.type === "date") && (
              <input
                id={fieldId}
                type={field.type === "text" ? "text" : field.type}
                inputMode={field.type === "url" ? "url" : undefined}
                placeholder={field.type === "url" ? "https://" : undefined}
                value={readText(block.props, field.key)}
                onChange={(event) => onUpdate(field.key, event.target.value)}
                className={control}
              />
            )}

            {field.type === "textarea" && (
              <textarea
                id={fieldId}
                rows={4}
                value={readText(block.props, field.key)}
                onChange={(event) => onUpdate(field.key, event.target.value)}
                className={cn(control, "resize-y leading-snug")}
              />
            )}

            {field.type === "choice" && (
              <Segmented label={field.label} value={readText(block.props, field.key, String(definition.defaults[field.key] ?? ""))} options={field.options} onChange={(value) => onUpdate(field.key, value)} />
            )}

            {field.type === "select" && (
              <select
                id={fieldId}
                value={readText(block.props, field.key)}
                onChange={(event) => onUpdate(field.key, event.target.value)}
                className={control}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === "list" && (
              <ListField field={field} values={readList(block.props, field.key)} onChange={(next) => onUpdate(field.key, next)} />
            )}

            {field.type === "image" && (
              <MediaField
                kind="image"
                value={readMedia(block.props, field.key)}
                onChange={(next) => onUpdate(field.key, next)}
                siteId={siteId}
                label={field.label}
              />
            )}

            {field.type === "items" && (
              <ItemsField field={field} items={readItems(block.props, field.key)} siteId={siteId} onChange={(next) => onUpdate(field.key, next)} />
            )}

            {"help" in field && <Help>{field.help}</Help>}
            </div>
          </div>
        );
      })}

      <StyleFields block={block} accent={accent} onUpdate={onUpdate} />

      {/* Every block gets an entrance animation */}
      <div className="flex flex-col gap-1.5 border-t border-ink/10 pt-4">
        <label htmlFor={`${id}-animation`} className="text-[0.75rem] font-medium text-ink/70">
          Entrance animation
        </label>
        <select
          id={`${id}-animation`}
          value={readAnimation(block.props)}
          onChange={(event) => onUpdate("animation", event.target.value)}
          className={control}
        >
          {ANIMATIONS.map((animation) => (
            <option key={animation.value} value={animation.value}>
              {animation.label}
            </option>
          ))}
        </select>
        <Help>Plays when the block scrolls into view on the live site. Changing it replays it here.</Help>
      </div>
    </>
  );
}

function ThemeCard({ theme, active, onPick }: { theme: Theme; active: boolean; onPick: () => void }) {
  const style = themeStyle(theme, theme.colors.accent);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      title={theme.mood}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border text-left transition-[border-color,box-shadow] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        active ? "border-ink ring-1 ring-ink" : "border-ink/12 hover:border-ink/35",
      )}
    >
      {/* A tiny page in the theme: heading face, text colour, button and second accent */}
      <span className="op-page flex h-[4.6rem] flex-col justify-between p-2.5" style={style}>
        <span className="flex items-center justify-between">
          <span className="font-[family-name:var(--t-heading)] text-[1.05rem] leading-none" style={{ color: theme.colors.text }}>
            Aa
          </span>
          <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: theme.colors.accent2 }} />
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-9 rounded-sw" style={{ backgroundColor: theme.colors.accent }} />
          <span aria-hidden="true" className="h-1 flex-1 rounded-full opacity-25" style={{ backgroundColor: theme.colors.text }} />
        </span>
      </span>
      <span className="flex items-center justify-between gap-1 border-t border-ink/10 bg-white px-2 py-1.5">
        <span className="truncate text-[0.74rem] font-medium text-ink">{theme.name}</span>
      </span>
    </button>
  );
}

function PageSettings({
  accent,
  theme,
  onAccent,
  onTheme,
}: {
  accent: string;
  theme: string;
  onAccent: (value: string) => void;
  onTheme: (id: string) => void;
}) {
  const current = themeById(theme);
  const custom = !ACCENTS.some((option) => option.value.toLowerCase() === accent.toLowerCase());

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="themes" className="flex flex-col gap-2">
        <p className="text-[0.75rem] font-medium text-ink/70">Theme</p>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
          {THEMES.map((option) => (
            <ThemeCard key={option.id} theme={option} active={option.id === current.id} onPick={() => onTheme(option.id)} />
          ))}
        </div>
        <Help>
          {current.mood}. Type: {FONT_LABELS[current.font]}. Changes colours, type and corners on every block; your content stays.
        </Help>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[0.75rem] font-medium text-ink/70">Brand colour</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {[current.colors.accent, ...ACCENTS.map((option) => option.value)]
            .filter((value, index, all) => all.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index)
            .map((value) => {
              const active = value.toLowerCase() === accent.toLowerCase();
              const label = ACCENTS.find((option) => option.value.toLowerCase() === value.toLowerCase())?.label ?? `${current.name} accent`;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onAccent(value)}
                  aria-label={label}
                  aria-pressed={active}
                  title={label}
                  className={cn(
                    "size-7 rounded-full border border-ink/15 transition-[box-shadow] duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    active && "ring-2 ring-ink ring-offset-1",
                  )}
                  style={{ backgroundColor: value }}
                />
              );
            })}
          <label
            title="Pick any colour"
            className={cn(
              "relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-full border border-ink/15",
              "bg-[conic-gradient(#ff8c88,#e5ca65,#edffc0,#bfe9ff,#d9bfff,#ff8c88)]",
              "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink",
              custom && "ring-2 ring-ink ring-offset-1",
            )}
          >
            <span className="sr-only">Custom brand colour</span>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#ff8c88"}
              onChange={(event) => onAccent(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <Help>Buttons, highlights and the site boundary on the map. Text on it turns dark or light by itself to stay readable.</Help>
      </div>
    </div>
  );
}

export function Inspector({
  block,
  accent,
  theme,
  onTheme,
  siteId,
  onUpdate,
  onAccent,
  onClearSelection,
  onClose,
  onMove,
  position,
}: {
  block: Block | null;
  accent: string;
  theme: string;
  onTheme: (id: string) => void;
  siteId: string;
  onUpdate: (key: string, value: unknown) => void;
  onAccent: (value: string) => void;
  onClearSelection: () => void;
  /** Shown when the inspector is a sheet on smaller screens. */
  onClose?: () => void;
  /** Moves the selected block up (-1) or down (1) the page. */
  onMove?: (step: -1 | 1) => void;
  /** The selected block's place on the page, for the move buttons. */
  position?: { index: number; count: number };
}) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        {block ? (
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 self-start rounded-[3px] font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronLeft className="size-3" aria-hidden="true" />
            Page · {definitionFor(block.kind).label}
          </button>
        ) : (
          <div>
            <p className="text-[0.95rem] font-medium tracking-[-0.01em] text-ink">Page settings</p>
            <p className="mt-0.5 text-[0.75rem] leading-snug text-ink/55">Select a block on the page to edit it.</p>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          {block && onMove && position && (
            <>
              <button type="button" onClick={() => onMove(-1)} disabled={position.index === 0} aria-label="Move block up" title="Move up (Alt + Up)" className={iconButton}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={position.index >= position.count - 1}
                aria-label="Move block down"
                title="Move down (Alt + Down)"
                className={iconButton}
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </button>
            </>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close panel" className={iconButton}>
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {block ? (
        <BlockFields key={block.id} block={block} accent={accent} siteId={siteId} onUpdate={onUpdate} />
      ) : (
        <PageSettings accent={accent} theme={theme} onAccent={onAccent} onTheme={onTheme} />
      )}
    </div>
  );
}
