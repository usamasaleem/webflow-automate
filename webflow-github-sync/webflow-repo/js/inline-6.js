document.addEventListener("DOMContentLoaded", () => {
    gsap.registerPlugin(ScrollTrigger, SplitText);
  
    const textEl = document.querySelector('[data-header="text"]');
    const triggerList = document.querySelector('[data-header="trigger-list"]');
  
    if (!textEl || !triggerList) return;
  
    // Split both words and characters
    const split = new SplitText(textEl, { type: "words, chars" });
  
    // Prevent mid-word breaking
    split.words.forEach(word => {
      word.style.display = "inline-block";
    });
  
    // Animate characters
    gsap.from(split.chars, {
      scrollTrigger: {
        trigger: triggerList,
        start: "top 85%",
        end: "bottom 65%",
        scrub: true,
        markers: true
      },
      opacity: 0,
      scale: 1.5, // Changed from 0.6 to 0.2 for a more noticeable scale effect
      y: 30,
      filter: "blur(12px)",
      ease: "power3.out",
      stagger: {
        amount: 1.0,
        from: "start"
      }
    });
});