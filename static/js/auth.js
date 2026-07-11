function initAuthForm({ formId, endpoint, statusId, buttonId, onSuccessRedirect, successMessage }) {
  const form = document.getElementById(formId);
  const status = document.getElementById(statusId);
  const button = document.getElementById(buttonId);

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());

    status.textContent = "";
    status.classList.remove("ok");
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Please wait…";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok && result.success) {
        status.textContent = successMessage;
        status.classList.add("ok");
        window.location.href = onSuccessRedirect;
        return;
      }

      status.textContent = result.message || "Something went wrong. Try again.";
    } catch (err) {
      status.textContent = "Couldn't reach the server. Check your connection.";
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
}
