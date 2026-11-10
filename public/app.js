const glyphs = {workflow:"[::]",heart:"<3",code:"</>",gamepad:"[[]]",globe:"(O)",app:"[+]"};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function safeUrl(value) {
  try { const url = new URL(value); return ["https:","http:"].includes(url.protocol) ? escapeHtml(url.href) : "#"; }
  catch { return "#"; }
}
function tick() {
  const now = new Date();
  document.querySelector("#clock").textContent = now.toLocaleTimeString("en-GB", {hour12:false});
  document.querySelector("#year").textContent = now.getFullYear();
}

async function loadServices() {
  const root = document.querySelector("#services");
  const count = document.querySelector("#service-count");
  try {
    const response = await fetch("/api/services", {cache:"no-store"});
    if (!response.ok) throw new Error("registry unavailable");
    const services = await response.json();
    count.textContent = String(services.length).padStart(2, "0");
    if (!services.length) {
      root.innerHTML = '<div class="terminal-message">[ EMPTY ] No services registered. Awaiting configuration<span class="cursor">_</span></div>';
      return;
    }
    root.innerHTML = services.map((service, index) => {
      const glyph = glyphs[service.icon] || glyphs.app;
      return `<a class="service-row" href="${safeUrl(service.url)}" target="_blank" rel="noopener noreferrer">
        <span class="service-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="service-glyph">${escapeHtml(glyph)}</span>
        <span class="service-main"><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(service.description || "No description supplied")}</small></span>
        <span class="service-meta"><small>${escapeHtml(service.category || "APPS")}</small><b><i></i> REGISTERED</b></span>
        <span class="service-arrow">↗</span>
      </a>`;
    }).join("");
  } catch {
    count.textContent = "--";
    root.innerHTML = '<div class="terminal-message error">[ ERROR ] Could not reach the service registry. Check the portal process<span class="cursor">_</span></div>';
  }
}

tick();
setInterval(tick, 1000);
loadServices();