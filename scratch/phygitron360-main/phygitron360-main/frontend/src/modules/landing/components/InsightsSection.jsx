import ceo from "../../../assets/ceo.png";
import cybersec from "../../../assets/cybersec.png";
import phy from "../../../assets/phy.png";

const InsightsSection = () => {
  return (
    <section className="insights">
      <div className="insights-container">

        {/* LEFT TEXT */}
        <div className="insights-left">
          <h2>
            Insights from <br />
            Industry Leaders
          </h2>

          <p>
            Explore expert perspectives, success stories, and future-focused
            conversations shaping cybersecurity, digital employability, AI,
            and workforce transformation.
          </p>
        </div>

        {/* RIGHT IMAGES */}
        <div className="insights-grid">

          {/* CEO (TOP RIGHT) */}
          <div className="insight-card insight-ceo">
            <img src={ceo} alt="CEO" />
          </div>

          {/* PHY (BOTTOM LEFT) */}
          <div className="insight-card insight-phy">
            <img src={phy} alt="Phygitron" />
          </div>

          {/* CYBERSEC (BOTTOM RIGHT) */}
          <div className="insight-card insight-cyber">
            <img src={cybersec} alt="Cybersecurity" />
          </div>

        </div>

      </div>
    </section>
  );
};

export default InsightsSection;