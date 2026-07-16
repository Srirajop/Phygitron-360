import bgPattern from "../../../assets/bg-pattern.png";

const features = [
  {
    title: "Market Sentiment and Needs Analysis",
    desc: "We predict technological changeover points and gauge the technology market trends from a human skills standpoint. We use Design Thinking practices and methods and tools like the Delphi Method, Growth Curves, and Horizon Scanning. These demand insights are combined with Demographic and Sociological Analyses and Opportunity Identification techniques to chart out the strategy and course for the subsequent talent sourcing, development and skilling, and deployment.",
  },
  {
    title: "AI-based Talent Sourcing",
  desc: "We use AI-based advanced decision-making engine to identify and source talent locally as well as from across the globe, including even the most unconventional or overlooked sources and talent pools.",
  },
  {
    title: "Automated Assessment",
    desc: "Our automated skill-based evaluation and analytics, with proctoring features, enables easy assessment of skills and aptitude for various digital and technology domains. In addition, interviews are included to gauge attitude, aptitude, skills, and fitment for deployment for an organization’s specific and unique business needs.",
  },
  {
    title: "Digital Powerhouse: Skilling and Development",
    desc: "Our skilling and development programs, which are a mix of several interventions (self-paced digital, instructor-led, practice, and on-the-job), prepares the talent pool to be effectively deployed and be high-performing members of the digital powerhouse of organizations.",
  },
  {
    title: "Engagement",
    desc: "Our talent engagement initiatives include hackathons and innovation contests, run periodically on various digital platforms.",
  },
  {
    title: "Diversity and Equity",
    desc: "Phygitron’s anonymity features at the initial screening stage will help organizations source profiles purely on merit and ensure bias-free screening .",
  },
];

const FeatureGrid = () => {
  return (
    <section className="feature-section">

      {/* BACKGROUND PATTERN */}
      <div
        className="feature-bg"
        style={{ backgroundImage: `url(${bgPattern})` }}
      />

      <div className="feature-container">

        {/* HEADER */}
        <div className="feature-header">
          <h2>
            Transforming Talent Into <br />
            Competitive Advantage
          </h2>

          <p>
            From intelligent sourcing and skill assessment to workforce development,
            engagement, and equitable hiring, Phygitron 360 helps organizations build
            future-ready teams with precision and speed.
          </p>
        </div>

        {/* GRID */}
        <div className="feature-grid">
          {features.map((item, i) => (
            <div key={i} className="feature-card">
              <div className="feature-bar" />

              <div className="feature-body">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default FeatureGrid;