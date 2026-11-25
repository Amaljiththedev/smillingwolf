"use client";

import { ChevronLeft, Plus, X } from "lucide-react";
import { useId } from "react";
import {
  ANIMATIONS,
  definitionFor,
  readAnimation,
  readList,
  readText,
  type Field,
} from "@/lib/blocks";
import { ACCENTS } from "@/lib/editor";
import type { Block } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The inspector. Fields come from the block registry, so a new block type
  gets an editing panel without any work here.
*/

const control =
  "w-full rounded-sw border border-ink/15 bg-white px-2.5 py-1.5 text-[0.85rem] text-ink transition-colors duration-150 focus:border-ink/40 focus:outline-none focus:ring-1 focus:ring-ink/30";

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
            className="grid size-7 shrink-0 place-items-center rounded-[3px] text-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, `${field.itemLabel} ${values.length + 1}`])}
        className="inline-flex items-center gap-1.5 self-start rounded-sw border border-ink/15 px-2 py-1 text-[0.78rem] text-ink/75 transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
      >
        <Plus className="size-3" aria-hidden="true" />
        Add {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

function BlockFields({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (key: string, value: unknown) => void;
}) {
  const id = useId();
  const definition = definitionFor(block.kind);

  return (
    <>
      {definition.fields.map((field) => {
        const fieldId = `${id}-${field.key}`;
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label
              htmlFor={field.type === "list" ? undefined : fieldId}
              className="text-[0.75rem] font-medium text-ink/70"
            >
              {field.label}
            </label>

            {field.type === "text" && (
              <input
                id={fieldId}
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
              <ListField
                field={field}
                values={readList(block.props, field.key)}
                onChange={(next) => onUpdate(field.key, next)}
              />
            )}
          </div>
        );
      })}

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
        <p className="text-[0.72rem] leading-snug text-ink/50">
          Plays when the block scrolls into view on the live site. Changing it replays it here.
        </p>
      </div>
    </>
  );
}

function PageSettings({ accent, onAccent }: { accent: string; onAccent: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.75rem] font-medium text-ink/70">Brand colour</p>
      <div className="flex flex-wrap gap-1.5">
        {ACCENTS.map((option) => {
          const active = option.value.toLowerCase() === accent.toLowerCase();
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onAccent(option.value)}
              aria-label={option.label}
              aria-pressed={active}
              title={option.label}
              className={cn(
                "size-7 rounded-full border border-ink/15 transition-[box-shadow] duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                active && "ring-2 ring-ink ring-offset-1",
              )}
              style={{ backgroundColor: option.value }}
            />
          );
        })}
      </div>
      <p className="mt-1 text-[0.72rem] leading-snug text-ink/50">
        Used for buttons, highlights and the site boundary on the map. Uploading a logo and choosing
        typefaces comes with the brand step.
      </p>
    </div>
  );
}

export function Inspector({
  block,
  accent,
  onUpdate,
  onAccent,
  onClearSelection,
}: {
  block: Block | null;
  accent: string;
  onUpdate: (key: string, value: unknown) => void;
  onAccent: (value: string) => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
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
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/50">Page</p>
      )}

      {block ? (
        <BlockFields key={block.id} block={block} onUpdate={onUpdate} />
      ) : (
        <PageSettings accent={accent} onAccent={onAccent} />
      )}
    </div>
  );
}
