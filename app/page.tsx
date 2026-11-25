import { Intro } from "@/components/intro/intro";
import { IntroProvider } from "@/components/intro/intro-provider";
import { Navbar } from "@/components/navigation/navbar";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { HeroMockup } from "@/components/sections/hero-mockup";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { TrustedMarquee } from "@/components/sections/trusted-marquee";

export default function Home() {
  return (
    <IntroProvider>
      <Intro headline="Have your say" />
      <Navbar />
      <main id="top" className="w-full bg-white text-ink">
        <Hero visual={<HeroMockup />}>
          <TrustedMarquee />
        </Hero>
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
    </IntroProvider>
  );
}
