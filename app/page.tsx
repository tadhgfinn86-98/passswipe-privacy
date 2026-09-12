import { AnnouncementBar } from "@/components/announcement-bar";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { TrustedBy } from "@/components/trusted-by";
import { FeatureSection } from "@/components/feature-section";
import { Testimonial } from "@/components/testimonial";
import { HowItWorks } from "@/components/how-it-works";
import { Security } from "@/components/security";
import { Pricing } from "@/components/pricing";
import { Testimonials } from "@/components/testimonials";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main id="main" className="flex-1">
        <Hero />
        <TrustedBy />
        <FeatureSection />
        <Testimonial />
        <HowItWorks />
        <Security />
        <Pricing />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
