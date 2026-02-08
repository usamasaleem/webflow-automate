document.addEventListener("DOMContentLoaded", () => {
  const faqItems = document.querySelectorAll('[data-faq="item"]');

  faqItems.forEach((item) => {
    item.addEventListener("click", () => {
      const question = item.querySelector('[data-faq="question"]');
      const icon = item.querySelector('[data-faq="icon"]');
      const answer = item.querySelector('[data-faq="answer"]');
      const isActive = item.classList.contains("is-active");

      // Remove all actives
      faqItems.forEach((faq) => {
        faq.classList.remove("is-active");
        faq.querySelector('[data-faq="question"]')?.classList.remove("is-active");
        faq.querySelector('[data-faq="icon"]')?.classList.remove("is-active");
        faq.querySelector('[data-faq="answer"]')?.classList.remove("is-active");
      });

      // Add actives to clicked one
      if (!isActive) {
        item.classList.add("is-active");
        question?.classList.add("is-active");
        icon?.classList.add("is-active");
        answer?.classList.add("is-active");
      }
    });
  });
});