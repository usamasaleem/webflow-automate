/* JavaScript | Page */

/* Page Load */
document.addEventListener("DOMContentLoaded", () => {

	// Hero Sequence
  document.querySelectorAll(".page_wrap").forEach((section) => {
    const heroEyebrow = section.querySelector("[page-load-eyebrow]");
    const heroHeading = section.querySelector("[page-load-title]");
    const heroSubheading = section.querySelector("[page-load-subtitle]");
    
    const tl = gsap.timeline();
    
    // Split Eyebrow
    const splitEyebrow = SplitText.create(heroEyebrow, {
      type: "lines",
      mask: "lines",
      linesClass: "line",
    });
    
    // Split Heading
    const splitHeading = SplitText.create(heroHeading, {
      type: "lines",
      mask: "lines",
      linesClass: "line",
    });
    
    // Split Subheading
    const splitSubheading = SplitText.create(heroSubheading, {
      type: "lines",
      mask: "lines",
      linesClass: "line",
    });
    
    // Timeline Animation
    // 1. Hero Eyebrow
    tl.from(splitEyebrow.lines, { 
    	yPercent: 110, 
      duration: 0.5, 
      stagger: { amount: 0.4 }
    }, "<50%");
    
    // 2. Hero Title
    tl.from(splitHeading.lines, { 
    	yPercent: 110, 
      duration: 0.5, 
      stagger: { amount: 0.4 }
    }, "<50%");
    
    // 1. Hero Subheading
    tl.from(splitSubheading.lines, { 
    	yPercent: 110, 
      duration: 0.5, 
      stagger: { amount: 0.4 }
    }, "<50%");
    
    // 4. Hero Icon
    tl.from("[page-load-icon]", { 
    	y: "24%",
      opacity: 0,
      duration: 1
    }, "<40%");
    
    // 5. Hero Label
    tl.from("[page-load-label]", { 
    	y: "20%",
      opacity: 0,
      duration: 0.8
    }, "<30%");
    
    // 6. Button
    tl.from("[page-load-button]", { 
    	y: "16%",
      opacity: 0,
      duration: 0.6
    }, "<20%");

    gsap.set(section.querySelectorAll("[data-prevent-flicker='true']"), { autoAlpha: 1 });
  });
});