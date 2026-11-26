"use client";

import { Check, CircleAlert, Crosshair, FileUp, Layers, LoaderCircle, MapPinned, Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { parseGridRef } from "@/lib/osgrid";
import {
  MAX_FLATTEN_BYTES,
  flattenSvgPlan,
  layerImage,
  needsFlattening,
  parseSvgPlan,
  planPlacement,
  shrinkImage,
  type ControlPoint,
  type SvgPlan,
} from "@/lib/svg-plan";
import { cn } from "@/lib/utils";

/*
  Inspector control for a layered SVG masterplan:
  - upload a file (or try the example). Light vector files are kept as they
    are; heavy ones (Photoshop renders, 100 MB+) are flattened to one image
    per layer in the browser, then uploaded to the media library;
  - name the layers and pick which show first;
  - place it on the map: click two known points and type their OS grid
    references (any scale or rotation), or give the corner references.
*/

const EXAMPLE = { url: "/demo/example-masterplan.svg", name: "example-masterplan.svg", sw: "SJ 89700 90250", ne: "SJ 90100 90550" };

/* Without a media library, layer images are kept with the page, so they must stay small. */
const KEEP_EDGE = 1800;
const KEEP_BUDGET = 3_000_000;

const input =
  "h-9 w-full rounded-sw border border-ink/15 bg-white px-2.5 text-[0.85rem] text-ink placeholder:text-ink/35 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";

function kb(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function uploadLayer(siteId: string, blob: Blob, name: string): Promise<string> {
  const body = new FormData();
  body.set("file", new File([blob], name, { type: "image/webp" }));
  const response = await fetch(`/builder/${encodeURIComponent(siteId)}/media`, { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? "The upload failed.");
  return data.url;
}

type Busy = { label: string; done: number; total: number } | null;

export function PlanField({
  value,
  onChange,
  siteId,
}: {
  value: SvgPlan | null;
  onChange: (next: SvgPlan | null) => void;
  siteId: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [dragging, setDragging] = useState(false);
  const [placing, setPlacing] = useState(false);
  const id = useId();

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!/\.svg$/i.test(file.name) && file.type !== "image/svg+xml") {
      setError("Choose an SVG file. Ask the architects to export the plan as SVG with its layers.");
      return;
    }
    if (file.size > MAX_FLATTEN_BYTES) {
      setError(`That SVG is ${kb(file.size)}, too big to open in a browser. Ask for a lighter export (under 400 MB).`);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy({ label: "Opening the file", done: 0, total: 1 });
    try {
      const text = await file.text();
      /* A new version of the same sheet keeps its placement; a different drawing starts afresh. */
      const sameSheet = (w: number, h: number) => value && Math.abs(value.width - w) < 0.5 && Math.abs(value.height - h) < 0.5;
      const keep = (w: number, h: number) =>
        sameSheet(w, h) && value ? { placement: value.placement, points: value.points, sw: value.sw, ne: value.ne } : {};
      if (!needsFlattening(text)) {
        const plan = parseSvgPlan(text, file.name);
        onChange({ ...plan, ...keep(plan.width, plan.height) });
        return;
      }

      /* Heavy file: one image per layer. */
      const flat = await flattenSvgPlan(text, file.name, {
        onProgress: (done, total, label) => setBusy({ label: label ? `Drawing "${label}"` : "Finishing", done, total }),
      });
      const keys = Object.keys(flat.blobs);
      const images: Record<string, string> = {};
      try {
        for (const [index, key] of keys.entries()) {
          const label = flat.plan.layers.find((l) => l.key === key)?.label ?? key;
          setBusy({ label: `Uploading "${label}"`, done: index, total: keys.length });
          const stem = file.name.replace(/\.svg$/i, "").slice(0, 40);
          images[key] = await uploadLayer(siteId, flat.blobs[key], `${stem}-${label}.webp`);
        }
      } catch {
        /* No media library (the hosted demo) or the upload failed: keep smaller copies with the page. */
        setBusy({ label: "Keeping a lighter copy with the page", done: 0, total: 1 });
        let total = 0;
        for (const key of keys) {
          images[key] = await shrinkImage(flat.blobs[key], KEEP_EDGE, 0.72);
          total += images[key].length;
        }
        if (total > KEEP_BUDGET) {
          throw new Error(
            `The layers come to ${kb(total)} even when reduced, too much to keep with the page without the media library. Connect WordPress, or ask for a simpler file.`,
          );
        }
        setNotice("The media library is not connected, so a lighter copy of each layer is kept with the page.");
      }
      onChange({ ...flat.plan, svg: "", images, ...keep(flat.plan.width, flat.plan.height) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function loadExample() {
    setBusy({ label: "Loading the example", done: 0, total: 1 });
    try {
      const response = await fetch(EXAMPLE.url);
      onChange({ ...parseSvgPlan(await response.text(), EXAMPLE.name), placement: "corners", sw: EXAMPLE.sw, ne: EXAMPLE.ne });
      setError(null);
    } catch {
      setError("The example plan could not be loaded.");
    }
    setBusy(null);
  }

  const fileControl = (
    <input
      ref={fileInput}
      type="file"
      accept=".svg,image/svg+xml"
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => void pick(event.target.files?.[0])}
    />
  );

  if (busy) return <Progress busy={busy} />;

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
          <FileUp className="size-5 text-ink/60" aria-hidden="true" />
          <span className="text-[0.82rem] font-medium text-ink">Upload a layered SVG</span>
          <span className="text-[0.72rem] text-ink/50">Drop it here or click. Large renders are reduced automatically.</span>
        </button>
        {fileControl}
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

  const update = (patch: Partial<SvgPlan>) => onChange({ ...value, ...patch });
  const flattened = !value.svg;

  return (
    <div className="flex flex-col gap-3">
      {/* The file */}
      <div className="flex items-center gap-2.5 rounded-sw border border-ink/10 bg-paper/50 p-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-sw bg-white">
          <Layers className="size-4 text-ink/70" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-medium text-ink" title={value.name}>
            {value.name}
          </span>
          <span className="block text-[0.7rem] text-ink/50">
            {value.layers.length} {value.layers.length === 1 ? "layer" : "layers"}
            {flattened ? " · reduced to images" : ` · ${kb(new Blob([value.svg]).size)}`}
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
        {fileControl}
      </div>
      {error && <Problem>{error}</Problem>}
      {notice && <p className="text-[0.72rem] leading-snug text-ink/55">{notice}</p>}

      {/* Layers */}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[0.72rem] text-ink/60">Layers. Ticked ones show when the page opens; visitors can switch any of them.</legend>
        {value.layers.map((layer, index) => (
          <div key={layer.key} className="flex items-center gap-2">
            <input
              id={`${id}-${layer.key}`}
              type="checkbox"
              checked={layer.on}
              onChange={(event) => update({ layers: value.layers.map((l, i) => (i === index ? { ...l, on: event.target.checked } : l)) })}
              className="size-4 shrink-0 accent-ink"
              aria-label={`Show ${layer.label} when the page opens`}
            />
            <input
              type="text"
              value={layer.label}
              onChange={(event) => update({ layers: value.layers.map((l, i) => (i === index ? { ...l, label: event.target.value } : l)) })}
              aria-label={`Name of layer ${index + 1}`}
              className={cn(input, "h-8 text-[0.8rem]")}
            />
          </div>
        ))}
      </fieldset>

      {/* Placement */}
      <div className="flex flex-col gap-2.5 rounded-sw border border-ink/10 p-2.5">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink/70">
          <MapPinned className="size-3.5" aria-hidden="true" />
          Place on the map
        </p>
        <div role="radiogroup" aria-label="How to place the plan" className="flex rounded-sw border border-ink/15 bg-paper/60 p-0.5">
          {(
            [
              ["points", "Two known points"],
              ["corners", "Corner references"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value.placement === key}
              onClick={() => update({ placement: key })}
              className={cn(
                "flex-1 rounded-[3px] px-2 py-1.5 text-[0.74rem] transition-colors focus-visible:outline-2 focus-visible:outline-ink",
                value.placement === key ? "bg-ink text-white" : "text-ink/65 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {value.placement === "points" ? (
          <>
            <p className="text-[0.72rem] leading-snug text-ink/55">
              Click two points on the plan that you have grid references for, such as setting-out points on the architects&apos; drawings.
              Far apart works best.
            </p>
            <button
              type="button"
              onClick={() => setPlacing(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-sw bg-ink px-3 text-[0.8rem] font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Crosshair className="size-3.5" aria-hidden="true" />
              {value.points[0] || value.points[1] ? "Adjust the two points" : "Set two points"}
            </button>
          </>
        ) : (
          <>
            <GridInput id={`${id}-sw`} label="Bottom-left corner" value={value.sw} onChange={(sw) => update({ sw })} />
            <GridInput id={`${id}-ne`} label="Top-right corner" value={value.ne} onChange={(ne) => update({ ne })} />
          </>
        )}

        <PlacementStatus plan={value} />
      </div>

      {placing && <PointsDialog plan={value} onClose={() => setPlacing(false)} onChange={(points) => update({ points })} />}
    </div>
  );
}

function PlacementStatus({ plan }: { plan: SvgPlan }) {
  const placed = planPlacement(plan);
  if (placed) {
    const turn = Math.abs(placed.rotation) < 0.05 ? "north-up" : `turned ${Math.abs(placed.rotation).toFixed(1)}° ${placed.rotation > 0 ? "clockwise" : "anticlockwise"}`;
    return (
      <p className="flex items-start gap-1.5 text-[0.72rem] leading-snug text-ink/60">
        <Check className="mt-px size-3.5 shrink-0 text-olive" aria-hidden="true" />
        Placed. The sheet covers {Math.round(placed.widthMetres)} m by {Math.round(placed.heightMetres)} m on the ground, {turn}.
      </p>
    );
  }
  if (plan.placement === "corners" && parseGridRef(plan.sw) && parseGridRef(plan.ne)) {
    return <Problem>The top-right corner must be east and north of the bottom-left corner.</Problem>;
  }
  return <p className="text-[0.72rem] leading-snug text-ink/50">Not placed yet, so the plan is shown at the scheme&apos;s centre.</p>;
}

function GridInput({
  id,
  label,
  value,
  onChange,
  compact = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const invalid = value.trim() !== "" && !parseGridRef(value);
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
        placeholder="SJ 89036 90168 or 389036.5, 390168.8"
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
        className={cn(input, "font-mono text-[0.78rem] uppercase", invalid && "border-coral", compact && "h-8")}
      />
      {invalid && <span className="text-[0.7rem] text-ink/60">Not a grid reference yet. Letters and digits, or eastings, northings in metres.</span>}
    </div>
  );
}

/* ---------- Click two points on the plan ---------- */

const POINT_COLOURS = ["#e5484d", "#2f6fed"] as const;

function PointsDialog({
  plan,
  onClose,
  onChange,
}: {
  plan: SvgPlan;
  onClose: () => void;
  onChange: (points: SvgPlan["points"]) => void;
}) {
  /* Where each point is on the drawing, and its grid reference, kept apart so a reference typed first does not make a point. */
  const [spots, setSpots] = useState(() => plan.points.map((p) => (p ? { x: p.x, y: p.y } : null)));
  const [refs, setRefs] = useState(() => plan.points.map((p) => p?.ref ?? ""));
  const points = spots.map((spot, i) => (spot ? { ...spot, ref: refs[i] } : null)) as SvgPlan["points"];
  const [active, setActive] = useState<0 | 1>(plan.points[0] ? (plan.points[1] ? 0 : 1) : 0);
  const [zoom, setZoom] = useState(1);
  const [shown, setShown] = useState(() => new Set(plan.layers.filter((l) => l.on).map((l) => l.key)));
  const stage = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const draft = { ...plan, points };
  const placed = planPlacement(draft);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onStageClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const spot: Pick<ControlPoint, "x" | "y"> = {
      x: ((event.clientX - rect.left) / rect.width) * plan.width,
      y: ((event.clientY - rect.top) / rect.height) * plan.height,
    };
    setSpots((all) => all.map((s, i) => (i === active ? spot : s)));
    if (active === 0 && !spots[1]) setActive(1);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-3 backdrop-blur-[2px] md:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="flex h-full max-h-[52rem] w-full max-w-[84rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
        {/* The plan */}
        <div className="relative min-h-0 flex-1 bg-paper">
          <div ref={stage} className="h-full overflow-auto">
            <div className="p-4" style={{ width: `${zoom * 100}%` }}>
              <div
                onClick={onStageClick}
                className="relative w-full cursor-crosshair bg-white shadow-sm"
                style={{ aspectRatio: `${plan.width} / ${plan.height}` }}
              >
                {plan.layers
                  .filter((layer) => shown.has(layer.key))
                  .map((layer) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={layer.key} src={layerImage(plan, layer.key)} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full select-none" />
                  ))}
                {points.map(
                  (point, index) =>
                    point && (
                      <span
                        key={index}
                        aria-hidden="true"
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${(point.x / plan.width) * 100}%`, top: `${(point.y / plan.height) * 100}%` }}
                      >
                        <span className="block size-6 rounded-full border-2 bg-white/30" style={{ borderColor: POINT_COLOURS[index] }} />
                        <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: POINT_COLOURS[index] }} />
                        <span
                          className="absolute -top-5 left-1/2 -translate-x-1/2 rounded px-1 font-mono text-[0.62rem] font-semibold text-white"
                          style={{ backgroundColor: POINT_COLOURS[index] }}
                        >
                          {index === 0 ? "A" : "B"}
                        </span>
                      </span>
                    ),
                )}
              </div>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full border border-ink/10 bg-white/90 p-1 shadow backdrop-blur">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} className="grid size-8 place-items-center rounded-full hover:bg-ink/5">
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="w-10 text-center font-mono text-[0.7rem] tabular-nums text-ink/60">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} className="grid size-8 place-items-center rounded-full hover:bg-ink/5">
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* The points */}
        <div className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-ink/10 p-4 md:w-80 md:border-l md:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-[1.05rem] font-medium text-ink">
                Place the plan
              </h2>
              <p className="mt-1 text-[0.76rem] leading-snug text-ink/60">
                Pick a point, click its spot on the plan (zoom in for accuracy), then type its grid reference.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-ink/50 hover:bg-ink/5 hover:text-ink">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {([0, 1] as const).map((index) => {
            const point = points[index];
            return (
              <div
                key={index}
                className={cn(
                  "flex flex-col gap-2 rounded-sw border p-2.5 transition-colors",
                  active === index ? "border-ink bg-paper/40" : "border-ink/10",
                )}
              >
                <button type="button" onClick={() => setActive(index)} className="flex items-center gap-2 text-left">
                  <span className="grid size-5 place-items-center rounded-full font-mono text-[0.62rem] font-semibold text-white" style={{ backgroundColor: POINT_COLOURS[index] }}>
                    {index === 0 ? "A" : "B"}
                  </span>
                  <span className="text-[0.8rem] font-medium text-ink">Point {index === 0 ? "A" : "B"}</span>
                  <span className="ml-auto text-[0.7rem] text-ink/50">
                    {point ? "On the plan" : active === index ? "Click the plan" : "Not set"}
                  </span>
                </button>
                <GridInput
                  id={`${titleId}-ref-${index}`}
                  label="Grid reference"
                  compact
                  value={refs[index]}
                  onChange={(ref) => setRefs((all) => all.map((r, i) => (i === index ? ref : r)))}
                />
              </div>
            );
          })}

          <PlacementStatus plan={draft} />

          <details className="text-[0.74rem] text-ink/60">
            <summary className="cursor-pointer">Layers shown here</summary>
            <div className="mt-2 flex flex-col gap-1">
              {plan.layers.map((layer) => (
                <label key={layer.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={shown.has(layer.key)}
                    onChange={(event) =>
                      setShown((all) => {
                        const next = new Set(all);
                        if (event.target.checked) next.add(layer.key);
                        else next.delete(layer.key);
                        return next;
                      })
                    }
                  />
                  {layer.label}
                </label>
              ))}
            </div>
          </details>

          <div className="mt-auto flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-9 flex-1 rounded-sw border border-ink/15 text-[0.82rem] text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(points);
                onClose();
              }}
              className="h-9 flex-1 rounded-sw bg-ink text-[0.82rem] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {placed ? "Use these points" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Progress({ busy }: { busy: NonNullable<Busy> }) {
  const share = busy.total ? busy.done / busy.total : 0;
  return (
    <div className="flex flex-col gap-2 rounded-sw border border-ink/10 bg-paper/50 p-3" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-[0.8rem] text-ink">
        <LoaderCircle className="size-4 animate-spin text-ink/60" aria-hidden="true" />
        <span className="min-w-0 truncate">{busy.label}</span>
      </p>
      <span className="h-1.5 overflow-hidden rounded-full bg-ink/10">
        <span className="block h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${Math.max(4, share * 100)}%` }} />
      </span>
      {busy.total > 1 && (
        <p className="text-[0.7rem] text-ink/50">
          {busy.done} of {busy.total}. Big renders take a little while; keep this tab open.
        </p>
      )}
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
