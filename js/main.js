(() => {
  "use strict";

  const MOBILE_MENU_BREAKPOINT = 850;
  const SUBMIT_TIMEOUT_MS = 15000;
  const SUCCESS_TITLE = "Dziękujemy za kontakt!";

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
     Zgłoszenia trafiają do Arkusza Google przez Apps Script (data-endpoint).
     ------------------------------------------------------------------ */
  const initOrderModal = () => {
    const modal = document.querySelector("[data-order-modal]");
    if (!modal) return;

    const form = modal.querySelector("[data-order-form]");
    const success = modal.querySelector("[data-order-success]");
    const error = modal.querySelector("[data-order-error]");
    const submit = modal.querySelector("[data-order-submit]");
    const title = modal.querySelector("[data-order-title]");
    const lead = modal.querySelector("[data-order-lead]");
    const submitLabel = submit.textContent;
    const titleLabel = title.textContent;

    const setSending = (isSending) => {
      submit.disabled = isSending;
      submit.textContent = isSending ? "Wysyłanie…" : submitLabel;
    };

    const resetForm = () => {
      form.reset();
      form.hidden = false;
      success.hidden = true;
      error.hidden = true;
      lead.hidden = false;
      title.textContent = titleLabel;
      setSending(false);
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

    const sendOrder = async () => {
      const response = await fetch(form.dataset.endpoint, {
        method: "POST",
        body: new URLSearchParams(new FormData(form)),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });
      const result = await response.json();
      if (!result.ok) throw new Error("Zgłoszenie odrzucone");
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

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      setSending(true);

      try {
        await sendOrder();
        form.hidden = true;
        lead.hidden = true;
        title.textContent = SUCCESS_TITLE;
        success.hidden = false;
        success.focus();
      } catch {
        error.hidden = false;
        setSending(false);
      }
    });
  };

  initMobileMenu();
  initOrderModal();
})();
