import { ArrowRight } from "lucide-react";
import { HowItWorksSteps, type Step } from "@/components/ui/how-it-works";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTAINER, GUTTER, SECTION_Y } from "@/lib/layout";
import { cn } from "@/lib/utils";

/* Steps describe only what the platform is stated to do. */
const STEPS: Step[] = [
  {
    title: "Bring your brand",
    description: "Your logo, colours and typefaces are set up once and carried across every block.",
    tone: "peach",
  },
  {
    title: "Build your pages",
    description: "Pick the blocks you need – proposals, masterplan, survey – and add your content.",
    tone: "blue",
  },
  {
    title: "Add the masterplan",
    description: "Put your plan on the interactive map and choose where people can leave comments.",
    tone: "lilac",
  },
  {
    title: "Go live",
    description: "Publish on your own domain. The site can be live the same day.",
    tone: "lime",
  },
  {
    title: "Gather feedback",
    description: "Map comments and survey responses come in as people take part.",
    tone: "yellow",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className={cn("overflow-x-clip bg-white", GUTTER, SECTION_Y)}
    >
      <div className={CONTAINER}>
        <header className="mb-6 md:mb-8">
          <SectionHeading
            id="how-it-works-title"
            label="How it works"
            title="From brief to live consultation in five steps."
          />
        </header>

        <HowItWorksSteps steps={STEPS} />

        <div className="mt-6 flex flex-col items-stretch justify-start gap-3 sm:flex-row sm:items-center md:mt-8">
          <a
            href="#demo"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-sw bg-coral px-6 text-[1rem] font-medium text-ink transition-colors duration-300 hover:bg-peach focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Book a live demo
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
          <a
            href="#features"
            className="inline-flex h-12 items-center justify-center rounded-sw border border-ink/15 px-6 text-[1rem] text-ink transition-colors duration-300 hover:border-ink/30 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            See the features
          </a>
        </div>
      </div>
    </section>
  );
}
