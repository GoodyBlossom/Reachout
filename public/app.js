const importButton = document.querySelector("#btn-primary");
const importForm = document.querySelector("#import-form");
const fileInput = document.querySelector("#input-file");
const uploadTitle = document.querySelector(".upload-title");
const formStatus = document.querySelector("#form-status");

importButton?.addEventListener("click", () => {
  document.querySelector("#import-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#input-church-name")?.focus({ preventScroll: true });
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.scrollTarget);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

fileInput?.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  uploadTitle.textContent = file ? file.name : "Tap to choose file";
});

importForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const church = document.querySelector("#input-church-name")?.value.trim();
  const coordinator = document.querySelector("#input-coordinator")?.value.trim();
  const file = fileInput?.files?.[0];

  if (!church || !coordinator || !file) {
    formStatus.textContent = "Add the outreach name, coordinator, and spreadsheet before starting.";
    return;
  }

  formStatus.textContent = `Ready to start follow-up for ${church}. Backend upload will connect here next.`;
});
