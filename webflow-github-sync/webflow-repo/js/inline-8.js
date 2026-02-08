/**
 * GSAP CTA Animation — Fully Synced
 * Visual crossfade and text animation happen together
 */
document.addEventListener("DOMContentLoaded", () => {
    // ==============================
    // 🎯 ELEMENTS
    // ==============================
    const visuals = gsap.utils.toArray('[data-cta^="visual-"]');
    const textEl = document.querySelector('[data-cta="text"]');
  
    if (!gsap || visuals.length === 0 || !textEl) {
      console.warn("GSAP or required elements missing.");
      return;
    }
  
    // ==============================
    // ⚙️ SETUP
    // ==============================
    gsap.set(visuals, { opacity: 0 });
    gsap.set(visuals[0], { opacity: 1 });
  
    const words = ["HARDER", "SMARTER"];
    let wordIndex = 0;
  
    // Helper: animate text per character with fade + blur
    function animateText(element, newText, delay = 0) {
      element.innerHTML = "";
      newText.split("").forEach((char) => {
        const span = document.createElement("span");
        span.textContent = char;
        span.style.display = "inline-block";
        span.style.opacity = 0;
        span.style.filter = "blur(6px)";
        element.appendChild(span);
      });
  
      gsap.to(element.children, {
        opacity: 1,
        filter: "blur(0px)",
        y: 0,
        duration: 1,
        ease: "power2.out",
        stagger: 0.05,
        delay: delay,
      });
    }
  
    // Initial text
    animateText(textEl, words[0]);
  
    // ==============================
    // 🎬 MASTER TIMELINE
    // ==============================
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
  
    visuals.forEach((fromVisual, i) => {
      const toVisual = visuals[(i + 1) % visuals.length];
  
      tl.add(() => {
        // update text + visuals together
        wordIndex = (wordIndex + 1) % words.length;
        animateText(textEl, words[wordIndex]);
  
        // crossfade visuals in sync
        gsap.to(fromVisual, {
          opacity: 0,
          duration: 1,
          ease: "power2.inOut",
        });
        gsap.to(toVisual, {
          opacity: 1,
          duration: 1,
          ease: "power2.inOut",
        });
      }, `+=2`); // delay between changes (you can tweak)
    });
  });