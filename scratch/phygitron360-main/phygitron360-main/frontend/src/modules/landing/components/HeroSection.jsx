import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import hero1 from "../../../assets/hero.png";
import hero2 from "../../../assets/hero2.png";
import hero3 from "../../../assets/hero3.png";
import hero4 from "../../../assets/hero4.png";

export default function HeroSection() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const slides = [
    {
      tag: "PHYGITRON SOURCE",
      title: "Discover the Right\nTalent, Faster",
      desc: "Intelligent candidate sourcing with rich profiles, verified experience, and dynamic skill mapping.",
      image: hero1,
    },
    {
      tag: "PHYGITRON DEPLOY",
      title: "Scale Workforce Deployment\nwith Confidence",
      desc: "Seamless onboarding, compliance, payroll, and workforce operations in one platform.",
      image: hero2,
    },
    {
      tag: "PHYGITRON VERIFY",
      title: "Verify Skills with\nConfidence",
      desc: "Evidence-based assessments that validate expertise and real-world capability.",
      image: hero3,
    },
    {
      tag: "PHYGITRON FORGE",
      title: "Build Skills That\nDrive Performance",
      desc: "Personalized learning journeys to strengthen capabilities and performance.",
      image: hero4,
    },
  ];

  // 🔥 auto slide
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero">
      {/* SLIDER */}
      <div
        className="hero-slider"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div className="hero-slide" key={i}>
            
            {/* TEXT */}
            <div className="hero-text">
              <p className="hero-tag">{slide.tag}</p>

              <h1>
                {slide.title.split("\n").map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </h1>

              <p className="hero-sub">{slide.desc}</p>

              
            </div>

            {/* IMAGE */}
            <div className="hero-image-full">
              <img src={slide.image} alt="hero" />
            </div>

          </div>
        ))}
      </div>

      {/* DOTS */}
      <div className="hero-dots">
        {slides.map((_, i) => (
          <span
            key={i}
            className={i === index ? "active" : ""}
            onClick={() => setIndex(i)}
          ></span>
        ))}
      </div>
    </section>
  );
}