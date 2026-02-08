document.addEventListener("DOMContentLoaded", function () {

  const wraps = document.querySelectorAll("[data-why^='wrap']");
  const contents = document.querySelectorAll("[data-why='content']");
  const arrows = document.querySelectorAll("[data-why='arrow']");
  const images = document.querySelectorAll("[data-why^='image']");

  function resetAll() {
    contents.forEach(c => c.classList.remove("is-active"));
    arrows.forEach(a => a.classList.remove("is-active"));
    images.forEach(i => i.classList.remove("is-active"));
  }

  wraps.forEach(wrap => {
    wrap.addEventListener("click", () => {
      resetAll();

      const wrapNum = wrap.getAttribute("data-why").replace("wrap-", ""); // "1" , "2" , "3"

      // Activate corresponding content
      wrap.querySelector("[data-why='content']").classList.add("is-active");
      wrap.querySelector("[data-why='arrow']").classList.add("is-active");

      // Activate matching image
      document.querySelector(`[data-why="image-${wrapNum}"]`).classList.add("is-active");
    });
  });

});