const cards = [
  {
    tag: "PHYGITRON SOURCE",
    title: "Create a Stronger Talent Pipeline",
    desc: "Reach better candidates, organize talent data, and uncover skill potential through a smarter sourcing system built for modern hiring teams.",
  },
  {
    tag: "PHYGITRON FORGE",
    title: "Turn Learning Into Business Impact",
    desc: "Equip teams with focused development programs that improve readiness, sharpen expertise, and support long-term performance growth.",
  },
  {
    tag: "PHYGITRON VERIFY",
    title: "Make Decisions Backed by Evidence",
    desc: "Measure capability through reliable assessments and trusted validation tools that bring clarity to hiring and workforce planning.",
  },
  {
    tag: "PHYGITRON DEPLOY",
    title: "Run Workforce Operations Smoothly",
    desc: "Coordinate onboarding, payroll, compliance, and deployment workflows through one connected system built for scale.",
  },
];

const PlatformSection = () => {
  return (
    <section className="platform">
      <div className="platform-container">

        <h2 className="platform-heading">
          One Platform.<br />
          Four Powerful Workforce Engines.
        </h2>

        <p className="platform-sub">
          From hiring the right talent to building skills, validating capabilities, and managing deployment, PHYGITRON brings the entire workforce lifecycle into one intelligent ecosystem.
        </p>

        <div className="platform-grid">
          {cards.map((card, i) => (
            <div key={i} className="platform-card">

              {/* TOP GRADIENT */}
              <div className="card-top">
                <p>
  PHYGITRON <span>{card.tag.split(" ")[1]}</span>
</p>
              </div>

              {/* BOTTOM BLACK */}
              <div className="card-bottom">
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <span className="platform-link">
  Explore More <span className="arrow">↗</span>
</span>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default PlatformSection;