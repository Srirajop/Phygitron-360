import clearwater from "../../../assets/clearwater.png";
import sunlife from "../../../assets/sunlife.png";
import wipro from "../../../assets/wipro.png";
import musigma from "../../../assets/musigma.png";
import tata from "../../../assets/tata.png";

const PartnersSection = () => {
  return (
    <section className="partners">

      {/* TITLE */}
      <h2 className="partners-title">Trusted Partners</h2>

      {/* LOGOS */}
      <div className="partners-logos">
        <img src={clearwater} alt="Clearwater" />
        <img src={sunlife} alt="Sun Life" />
        <img src={wipro} alt="Wipro" />
        <img src={musigma} alt="Mu Sigma" />
        <img src={tata} alt="Tata Advanced Systems" />
      </div>

    </section>
  );
};

export default PartnersSection;