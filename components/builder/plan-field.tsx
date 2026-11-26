"use client";

import { Check, CircleAlert, FileUp, Layers, LoaderCircle, MapPinned, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { gridToLatLng, parseGridRef } from "@/lib/osgrid";
import { MAX_SVG_BYTES, parseSvgPlan, planCorners, type SvgPlan } from "@/lib/svg-plan";
import { cn } from "@/lib/utils";

/*
  Inspector control for a layered SVG masterplan: upload (or try the example),
  name the layers and pick which show first, and place it with the OS grid
  references of its bottom-left and top-right corners.

  The SVG is kept with the page (it is text, and small), so it needs no
  WordPress upload.
*/

const EXAMPLE = { url: "/demo/example-masterplan.svg", name: "example-masterplan.svg", sw: "SJ 89700 90250", ne: "SJ 90100 90550" };

const input =
  "h-9 w-full rounded-sw border border-ink/15 bg-white px-2.5 text-[0.85rem] text-ink placeholder:text-ink/35 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";

function kb(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PlanField({ value, onChange }: { value: SvgPlan | null; onChange: (next: SvgPlan | null) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const id = useId();

  async function load(text: string, name: string, keep?: Pick<SvgPlan, "sw" | "ne">) {
    try {
      const plan = parseSvgPlan(text, name);
      onChange({ ...plan, sw: keep?.sw ?? value?.sw ?? "", ne: keep?.ne ?? value?.ne ?? "" });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!/\.svg$/i.test(file.name) && file.type !== "image/svg+xml") {
      setError("Choose an SVG file. Ask the architects to export the plan as SVG with its layers.");
      return;
    }
    if (file.size > MAX_SVG_BYTES) {
      setError(`That SVG is ${kb(file.size)}. The limit is 1.5 MB, so ask for a lighter export.`);
      return;
    }
    setBusy(true);
    await load(await file.text(), file.name);
    setBusy(false);
  }

  async function loadExample() {
    setBusy(true);
    try {
      const response = await fetch(EXAMPLE.url);
      await load(await response.text(), EXAMPLE.name, { sw: EXAMPLE.sw, ne: EXAMPLE.ne });
    } catch {
      setError("The example plan could not be loaded.");
    }
    setBusy(false);
  }

  if (!value) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void pick(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-sw border border-dashed px-3 py-5 text-center transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            dragging ? "border-ink bg-lime/30" : "border-ink/20 bg-paper/50 hover:border-ink/40",
          )}
        >
          {busy ? <LoaderCircle className="size-5 animate-spin text-ink/60" aria-hidden="true" /> : <FileUp className="size-5 text-ink/60" aria-hidden="true" />}
          <span className="text-[0.82rem] font-medium text-ink">Upload a layered SVG</span>
          <span className="text-[0.72rem] text-ink/50">Drop it here or click. Up to 1.5 MB.</span>
        </button>
        <input ref={fileInput} type="file" accept=".svg,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(event) => void pick(event.target.files?.[0])} />
        <button
          type="button"
          onClick={() => void loadExample()}
          className="self-start text-[0.76rem] text-ink/60 underline decoration-ink/25 underline-offset-2 hover:text-ink hover:decoration-ink"
        >
          Try the example plan
        </button>
        {error && <Problem>{error}</Problem>}
      </div>
    );
  }

  const sw = parseGridRef(value.sw);
  const ne = parseGridRef(value.ne);
  const corners = planCorners(value);
  const size = new Blob([value.svg]).size;
  const update = (patch: Partial<SvgPlan>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      {/* The file */}
      <div className="flex items-center gap-2.5 rounded-sw border border-ink/10 bg-paper/50 p-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-sw bg-white">
          <Layers className="size-4 text-ink/70" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-medium text-ink">{value.name}</span>
          <span className="block text-[0.7rem] text-ink/50">
            {value.layers.length} {value.layers.length === 1 ? "layer" : "layers"} · {kb(size)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="h-7 rounded-sw border border-ink/15 bg-white px-2 text-[0.72rem] text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove the plan"
          className="grid size-7 place-items-center rounded-sw text-ink/50 hover:bg-coral/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
        <input ref={fileInput} type="file" accept=".svg,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(event) => void pick(event.target.files?.[0])} />
      </div>
      {error && <Problem>{error}</Problem>}

      {/* Layers */}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[0.72rem] text-ink/60">Layers. Ticked ones show when the page opens; visitors can switch any of them.</legend>
        {value.layers.map((layer, index) => (
          <div key={layer.key} className="flex items-center gap-2">
            <input
              id={`${id}-${layer.key}`}
              type="checkbox"
              checked={layer.on}
              onChange={(event) =>
                update({ layers: value.layers.map((l, i) => (i === index ? { ...l, on: event.target.checked } : l)) })
              }
              className="size-4 shrink-0 accent-ink"
              aria-label={`Show ${layer.label} when the page opens`}
            />
            <input
              type="text"
              value={layer.label}
              onChange={(event) =>
                update({ layers: value.layers.map((l, i) => (i === index ? { ...l, label: event.target.value } : l)) })
              }
              aria-label={`Name of layer ${index + 1}`}
              className={cn(input, "h-8 text-[0.8rem]")}
            />
          </div>
        ))}
      </fieldset>

      {/* Placement */}
      <div className="flex flex-col gap-2 rounded-sw border border-ink/10 p-2.5">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink/70">
          <MapPinned className="size-3.5" aria-hidden="true" />
          Place on the map
        </p>
        <GridInput id={`${id}-sw`} label="Bottom-left corner" value={value.sw} ok={!!sw} onChange={(sw) => update({ sw })} />
        <GridInput id={`${id}-ne`} label="Top-right corner" value={value.ne} ok={!!ne} onChange={(ne) => update({ ne })} />
        {corners ? (
          <p className="flex items-center gap-1.5 text-[0.72rem] text-ink/60">
            <Check className="size-3.5 text-olive" aria-hidden="true" />
            Placed at {fmtLatLng(gridToLatLng(sw!))}, {Math.round(ne!.easting - sw!.easting)} m by {Math.round(ne!.northing - sw!.northing)} m.
          </p>
        ) : sw && ne ? (
          <Problem>The top-right corner must be east and north of the bottom-left corner.</Problem>
        ) : (
          <p className="text-[0.72rem] leading-snug text-ink/50">
            Ordnance Survey grid references for the drawing&apos;s corners, from the architects, such as SJ 89700 90250 or 389700, 390250.
            Until both are set the plan is shown at the scheme&apos;s centre.
          </p>
        )}
      </div>
    </div>
  );
}

function fmtLatLng([lat, lng]: [number, number]) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function GridInput({ id, label, value, ok, onChange }: { id: string; label: string; value: string; ok: boolean; onChange: (value: string) => void }) {
  const invalid = value.trim() !== "" && !ok;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[0.7rem] text-ink/60">
        {label}
      </label>
      <input
        id={id}
        type="text"
        spellCheck={false}
        autoComplete="off"
        value={value}
        placeholder="SJ 89700 90250"
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
        className={cn(input, "font-mono text-[0.8rem] uppercase", invalid && "border-coral")}
      />
      {invalid && <span className="text-[0.7rem] text-ink/60">Not a grid reference yet. Use letters and digits (SJ 89700 90250) or eastings, northings.</span>}
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 rounded-sw bg-coral/15 px-2 py-1.5 text-[0.74rem] leading-snug text-ink">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
