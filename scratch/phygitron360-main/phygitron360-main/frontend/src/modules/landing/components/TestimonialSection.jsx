const TestimonialSection = () => {
  return (
    <section className="testimonial">

      {/* HEADING */}
      <h2 className="testimonial-title">
        Phygitron Received <span>4.8/5</span> Stars <br />
        in Over 10,000+ Reviews
      </h2>

      {/* BACKGROUND QUOTES */}
      <div className="quote quote-left">“</div>
      <div className="quote quote-right">”</div>

      {/* CARD */}
      <div className="testimonial-card">
        <h3>Testimonial 1</h3>

        <p>
          Explore expert perspectives, success stories, and future-focused
          conversations shaping cybersecurity, digital employability, AI,
          and workforce transformation.
        </p>

        <div className="stars">
          ★ ★ ★ ★ <span>★</span>
        </div>
      </div>

    </section>
  );
};

export default TestimonialSection;