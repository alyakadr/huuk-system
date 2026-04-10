import React from "react";
import aboutVisual from "../../assets/modalcust1.jpg";

const AboutUs = () => (
  <div className="cust-about-us">
    <div className="cust-about-shell">
      <article className="cust-about-side-card cust-about-side-left" aria-hidden>
        <h3>EVENT</h3>
        <p>
          We host monthly community events in collaboration with local brands
          and neighborhoods.
        </p>
        <p>
          Every event gives back through free haircuts and grooming support for
          youth and urban communities.
        </p>
      </article>

      <article className="cust-about-main-card">
        <h2>ABOUT US</h2>
        <div className="cust-about-columns">
          <p>
            At Huuk Barbershop, we are dedicated to providing affordably priced,
            unparalleled hair styling and grooming services tailored to every
            client and their lifestyle in a distinctly unique atmosphere.
          </p>
          <p>
            Gentlemen from all corners of Kuala Lumpur and further afield flock
            to our barbershop for the pampering and high level of care they know
            they will receive.
          </p>
          <p>
            Huuk Barbershop offers both a style and a community experience. Our
            social setting gives customers a chance to relax and enjoy service
            while experiencing a customized level of care.
          </p>
          <p>
            We aim to be your home from home, where you always feel special and
            welcome within our relaxed surroundings, and leave with total
            confidence.
          </p>
        </div>
      </article>

      <article className="cust-about-side-card cust-about-side-right" aria-hidden>
        <h3>OUR STYLE</h3>
        <div className="cust-about-image-frame">
          <img src={aboutVisual} alt="Huuk barbershop interior" />
        </div>
        <p>
          Signature cuts and clean finishes in a premium, modern barbershop
          environment.
        </p>
      </article>
    </div>

    <div className="cust-about-dots" aria-hidden>
      <span className="active" />
      <span />
      <span />
      <span />
    </div>
  </div>
);

export default AboutUs;
