"use client";

import { DEVICES, type Device } from "@/lib/devices";
import { cn } from "@/lib/utils";

/* The Desktop / Tablet / Phone switch used by the canvas and the preview. */

export function DeviceSwitch({
  device,
  onChange,
  className,
}: {
  device: Device;
  onChange: (device: Device) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Preview size" className={cn("inline-flex rounded-full border border-ink/10 bg-white p-0.5", className)}>
      {DEVICES.map(({ key, label, icon: Icon }) => {
        const active = key === device;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[0.76rem] transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
              active ? "bg-ink text-white" : "text-ink/60 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
