import { useNavigate } from "react-router-dom";
import logo from "../../../assets/logo.png";
const Navbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="nav">
      <div className="nav-left">
  <img 
    src={logo} 
    alt="Phygitron Logo" 
    style={{ height: "30px", width: "auto" }}
    style={{ marginLeft: "80px" }}
  />
</div>

      <div className="nav-right">
        <span>ABOUT PHYGITRON</span>
        <span>NEWS</span>
        <span>RESOURCES</span>

        <button className="launch-btn" onClick={() => navigate("/login")}>
          Launch Portal
        </button>

        <button className="contact-btn" onClick={() => navigate("/contact")}>
          CONTACT US
        </button>
      </div>
    </nav>
  );
};

export default Navbar;