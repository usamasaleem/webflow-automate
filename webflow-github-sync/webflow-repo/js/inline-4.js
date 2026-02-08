document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin();

  const bgs = document.querySelectorAll('[data-home-hero^="bg"]');
  const cards = document.querySelectorAll('[data-home-hero^="card"]');
  const total = bgs.length;
  let current = 0;

  // Initial states
  gsap.set(bgs, { opacity: 0 });
  gsap.set(cards, { opacity: 0, pointerEvents: "none" });
  gsap.set(bgs[0], { opacity: 1 });
  gsap.set(cards[0], { opacity: 1, pointerEvents: "auto" });

  function crossfadeSet() {
    const next = (current + 1) % total;

    // Crossfade backgrounds
    gsap.to(bgs[current], {
      opacity: 0,
      duration: 2.5,
      ease: "power2.inOut"
    });
    gsap.to(bgs[next], {
      opacity: 1,
      duration: 2.5,
      ease: "power2.inOut"
    });

    // Crossfade cards
    gsap.to(cards[current], {
      opacity: 0,
      duration: 2.5,
      ease: "power2.inOut",
      onStart: () => gsap.set(cards[current], { pointerEvents: "none" })
    });
    gsap.to(cards[next], {
      opacity: 1,
      duration: 2.5,
      ease: "power2.inOut",
      onStart: () => gsap.set(cards[next], { pointerEvents: "auto" })
    });

    current = next;
  }

  // Change every 5 seconds
  setInterval(crossfadeSet, 5000);
});