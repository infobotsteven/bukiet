(() => {
  "use strict";

  const { fetchJson, isClickOutside } = window.KzS;

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

    nav.querySelectorAll(".nav__links a, .nav__links button").forEach((link) => {
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
    const notes = form.elements.notes;
    const productBox = modal.querySelector("[data-order-product]");
    const productName = modal.querySelector("[data-order-product-name]");
    const productId = modal.querySelector("[data-order-product-id]");
    let selectedProduct = null;
    const submitLabel = submit.textContent;

    // Dwa tryby okna: czysty kontakt (domyślny) i zamówienie kompozycji z katalogu.
    // Teksty trybu kontaktowego to zawartość HTML, teksty zamówienia siedzą w atrybutach data-*-order.
    const texts = {
      contact: {
        title: title.textContent,
        lead: lead.textContent.trim(),
        placeholder: notes.placeholder,
      },
      order: {
        title: title.dataset.textOrder,
        lead: lead.dataset.textOrder,
        placeholder: notes.dataset.placeholderOrder,
      },
    };

    const setSending = (isSending) => {
      submit.disabled = isSending;
      submit.textContent = isSending ? "Wysyłanie…" : submitLabel;
    };

    // Kompozycja wybrana w katalogu (id + nazwa) jest wysyłana osobnymi polami; bez niej okno jest czysto kontaktowe.
    const setProduct = (product) => {
      selectedProduct = product && product.id && product.name ? product : null;
      productBox.hidden = !selectedProduct;
      productName.textContent = selectedProduct ? selectedProduct.name : "";
      productId.textContent = selectedProduct ? selectedProduct.id : "";

      const mode = texts[selectedProduct ? "order" : "contact"];
      title.textContent = mode.title;
      lead.textContent = mode.lead;
      notes.placeholder = mode.placeholder;
    };

    const resetForm = () => {
      form.reset();
      setProduct(null);
      form.hidden = false;
      success.hidden = true;
      error.hidden = true;
      lead.hidden = false;
      setSending(false);
    };

    const buildBody = () => {
      const body = new URLSearchParams(new FormData(form));
      if (selectedProduct) {
        body.set("product_id", selectedProduct.id);
        body.set("product_name", selectedProduct.name);
      }
      return body;
    };

    const sendOrder = async () => {
      const result = await fetchJson(
        form.dataset.endpoint,
        { method: "POST", body: buildBody() },
        SUBMIT_TIMEOUT_MS
      );
      if (!result.ok) throw new Error("Zgłoszenie odrzucone");
    };

    const openModal = (product) => {
      resetForm();
      setProduct(product);
      modal.showModal();
    };

    document.querySelectorAll("[data-order-open]").forEach((trigger) => {
      trigger.addEventListener("click", () => openModal(null));
    });

    // Otwarcie okna z innych modułów (np. z katalogu): detail.product = { id, name }.
    document.addEventListener("order:open", (event) => {
      openModal(event.detail && event.detail.product);
    });

    modal.querySelectorAll("[data-order-close]").forEach((button) => {
      button.addEventListener("click", () => modal.close());
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal && isClickOutside(event, modal)) modal.close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      setSending(true);

      try {
        await sendOrder();
        form.hidden = true;
        lead.hidden = true;
        productBox.hidden = true;
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
