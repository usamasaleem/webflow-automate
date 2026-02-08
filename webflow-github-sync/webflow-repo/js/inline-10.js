/* ---------- JavaScript | Global ---------- */

// --- Initialize All Scripts on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
  initSideNavigationWipeEffect();
  initNavScrollBehavior();
});


/* ----- GSAP Animation ----- */
  
/* Split Text */
document.addEventListener("DOMContentLoaded", () => {
	if (typeof window.gsap === "undefined") document.documentElement.classList.add("gsap-not-found");
	gsap.registerPlugin(ScrollTrigger, SplitText);
});

// Text Split Animation
// Targets Element
document.fonts.ready.then(() => {
  document.querySelectorAll("[data-line-reveal='true']").forEach((text) => {
    const split = new SplitText(text, {
      type: "lines",
      autoSplit: true,
      mask: "lines",
      linesClass: "line",
    });

    gsap.timeline({
      scrollTrigger: {
        trigger: text,
        start: "top bottom",
        end: "top 90%",
        toggleActions: "none play none none",
      },
    })
    .from(split.lines, {
      yPercent: 110,
      duration: 0.4,
      stagger: { amount: 0.2 },
    });

    gsap.set(text, { autoAlpha: 1 });
  });
});

// Targets Children Element (Perfect for Rich Text)
// Text Split Animation - Targeting the children of the element
document.fonts.ready.then(() => {
  document.querySelectorAll("[data-line-children-reveal='true']").forEach((container) => {
    const children = container.children;

    for (const child of children) {
      const split = new SplitText(child, {
        type: "lines",
        autoSplit: true,
        mask: "lines",
        linesClass: "line",
      });

      gsap.timeline({
        scrollTrigger: {
          trigger: child,
          start: "top bottom",
          end: "top 90%",
          toggleActions: "none play none none",
        },
      })
      .from(split.lines, {
        yPercent: 110,
        duration: 0.4,
        stagger: { amount: 0.2 },
      });
    }

    gsap.set(container, { autoAlpha: 1 });
  });
});

// Element Reveal Animation
document.querySelectorAll("[data-element-reveal='true']").forEach((element) => {
  gsap.timeline({
    scrollTrigger: {
      trigger: element,
      start: "top bottom",
      end: "top 90%",
      toggleActions: "play none none none",
    },
  })
  .from(element, {
    opacity: 0,
    yPercent: 10,
    duration: 0.8,
    ease: "power2.out"
  });
});

// Line Reveal Animation
$("[section-line-animation]").each(function () {
  let triggerElement = $(this)[0];
  let targetElement = $(this)[0];
  let tl = gsap.timeline({
    scrollTrigger: {
      trigger: triggerElement,
      start: "top 90%",
      toggleActions: "play none none none",
    }
  });
  tl.fromTo(targetElement,
    {width: "0%"},
    {width: "100%", duration: 1, ease: "power2.out"}
  );
});