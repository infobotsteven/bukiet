(() => {
  "use strict";

  const MOBILE_MENU_BREAKPOINT = 850;

  /* ------------------------------------------------------------------
     Menu mobilne
     ------------------------------------------------------------------ */
  const initMobileMenu = () => {
    const nav = document.querySelector("[data-nav]");
    const toggle = document.querySelector("[data-nav-toggle]");
    if (!nav || !toggle) return;

    const setOpen = (isOpen) => {
      nav.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.querySelectorAll(".nav__links a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    window
      .matchMedia(`(min-width: ${MOBILE_MENU_BREAKPOINT + 1}px)`)
      .addEventListener("change", (event) => {
        if (event.matches) setOpen(false);
      });
  };

  /* ------------------------------------------------------------------
     Okno zamówienia (natywny <dialog>: obsługuje Esc i pułapkę fokusu)
     ------------------------------------------------------------------ */
  const initOrderModal = () => {
    const modal = document.querySelector("[data-order-modal]");
    if (!modal) return;

    const form = modal.querySelector("[data-order-form]");
    const success = modal.querySelector("[data-order-success]");

    const resetForm = () => {
      form.reset();
      form.hidden = false;
      success.hidden = true;
    };

    const isClickOutside = (event) => {
      const box = modal.getBoundingClientRect();
      return (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      );
    };

    document.querySelectorAll("[data-order-open]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        resetForm();
        modal.showModal();
      });
    });

    modal.querySelectorAll("[data-order-close]").forEach((button) => {
      button.addEventListener("click", () => modal.close());
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal && isClickOutside(event)) modal.close();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      // Wersja demonstracyjna: tu docelowo trafi wysyłka do systemu zamówień.
      form.hidden = true;
      success.hidden = false;
      success.focus();
    });
  };

  initMobileMenu();
  initOrderModal();
})();
