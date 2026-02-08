/* JavaScript | Page Theme Change */
document.addEventListener("colorThemesReady", () => {
  $("[data-animate-theme-to]").each(function () {
    let theme = $(this).attr("data-animate-theme-to");
    let brand = $(this).attr("data-animate-brand-to");

    ScrollTrigger.create({
      trigger: $(this),
      start: "top center",
      end: "bottom center",
      onToggle: ({ self, isActive }) => {
        if (isActive) gsap.to("body", { ...colorThemes.getTheme(theme, brand) });
      }
    });
  });
});