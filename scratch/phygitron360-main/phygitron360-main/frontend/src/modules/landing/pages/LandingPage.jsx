import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import "../styles/landing.css";
import PlatformSection from "../components/PlatformSection";
import FeatureGrid from "../components/FeatureGrid";
import InsightsSection from "../components/InsightsSection";
import PartnersSection from "../components/PartnersSection";
import TestimonialSection from "../components/TestimonialSection";
import Footer from "../components/Footer";
export default function LandingPage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <PlatformSection />
      <FeatureGrid />
      <InsightsSection />
      <PartnersSection />
      <TestimonialSection />
      <Footer />
    </>
  );
}
