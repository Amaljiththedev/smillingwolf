import {
  BarListVisual,
  ChecklistVisual,
  FeatureUIRow,
  TimelineVisual,
} from "@/components/ui/feature-ui-row";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTAINER, GUTTER, SECTION_Y } from "@/lib/layout";
import { cn } from "@/lib/utils";

/*
  Features – stacked rows, alternating text/visual sides.
  No pinned scroller – four features isn't enough to justify the scroll cost.
  Visuals use the fictional "Millbrook Yards" site and are tagged "Example".
*/

const FEATURES = [
  {
    tone: "peach" as const,
    eyebrow: "Modular pages",
    title: "Build the site from ready-made blocks",
    body: "Put together the pages a consultation needs – the proposals, the masterplan, the survey – from blocks designed for planning consultation.",
    cta: { label: "See how it works", href: "#how-it-works" },
    visual: (
      <ChecklistVisual
        title="Pages · Millbrook Yards"
        rows={[
          { label: "Overview", value: "Published" },
          { label: "The masterplan", value: "Published" },
          { label: "Have your say", value: "Published" },
          { label: "Timeline", value: "Draft", done: false },
        ]}
      />
    ),
  },
  {
    tone: "blue" as const,
    eyebrow: "Interactive masterplan map",
    title: "Let people comment on the plan itself",
    body: "Residents drop a pin on the masterplan and comment on that exact spot. They can see what others have said, and your team sees feedback by location.",
    cta: { label: "Explore the map", href: "#map" },
    visual: (
      <BarListVisual
        title="Comments by location"
        items={[
          { label: "Canal path", value: 48, marker: "1" },
          { label: "New park", value: 36, marker: "2" },
          { label: "Mill Lane", value: 21, marker: "3" },
          { label: "Wharf Road", value: 12, marker: "4" },
        ]}
      />
    ),
  },
  {
    tone: "lime" as const,
    eyebrow: "Surveys",
    title: "Ask the questions you need answered",
    body: "Run surveys beside the proposals, so people answer with the plans in front of them. Responses appear as they arrive.",
    visual: (
      <BarListVisual
        title="How would you travel to the new park?"
        suffix="%"
        items={[
          { label: "Walk", value: 46 },
          { label: "Cycle", value: 28 },
          { label: "Bus", value: 18 },
          { label: "Car", value: 8 },
        ]}
        stat={{ value: 312, label: "Responses" }}
      />
    ),
  },
  {
    tone: "lilac" as const,
    eyebrow: "Your brand, your domain",
    title: "Live in a day, under your own name",
    body: "Your colours, typefaces and logo on every page, at your own web address. Residents see your consultation, not ours.",
    cta: { label: "Book a live demo", href: "#demo" },
    visual: (
      <TimelineVisual
        title="From brief to live site"
        stages={[
          { label: "Brand", span: 2 },
          { label: "Pages and map", span: 4 },
          { label: "Domain", span: 2 },
        ]}
        ticks={["9am", "11am", "1pm", "3pm", "5pm"]}
        note="Live on your own domain the same day"
      />
    ),
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className={cn("bg-white", GUTTER, SECTION_Y)}
    >
      <div className={CONTAINER}>
        <header className="mb-8 md:mb-10">
          <SectionHeading
            id="features-title"
            label="Features"
            title="Everything a planning consultation needs, under your name."
          />
        </header>

        <div className="flex flex-col gap-8 md:gap-10">
          {FEATURES.map((f, i) => (
            <FeatureUIRow
              key={f.title}
              reverse={i % 2 === 1}
              tone={f.tone}
              eyebrow={f.eyebrow}
              title={f.title}
              body={f.body}
              cta={f.cta}
              visual={f.visual}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
