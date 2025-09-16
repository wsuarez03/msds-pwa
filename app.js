async function loadCatalog() {
  const res = await fetch("catalog.json");
  const catalog = await res.json();

  const list = document.getElementById("pdf-list");
  list.innerHTML = "";

  catalog.forEach(item => {
    const li = document.createElement("li");
    const url = `pdfs/${item.filename}`;

    const date = new Date(item.date);
    const now = new Date();
    const fiveYears = new Date(date);
    fiveYears.setFullYear(date.getFullYear() + 5);

    let status = "";
    if (now > fiveYears) {
      status = "⛔ Vencido";
    } else if ((fiveYears - now) / (1000 * 60 * 60 * 24 * 30) < 6) {
      status = "⚠️ Por vencer (<6 meses)";
    }

    li.innerHTML = `
      <a href="${url}" target="_blank">${item.name} (v${item.version})</a>
      <span>${status}</span>
    `;

    list.appendChild(li);
  });
}

document.getElementById("add-pdf").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const name = prompt("Nombre del producto:");
  const version = prompt("Versión:");
  const date = new Date().toISOString();

  const metadata = {
    id: crypto.randomUUID(),
    name,
    filename: file.name,
    version,
    date
  };

  await uploadToGitHub(file, metadata);
});

async function uploadToGitHub(file, metadata) {
  const repo = "USUARIO/REPO"; // ⚠️ CAMBIAR
  const branch = "main";
  const token = "TOKEN_GITHUB"; // ⚠️ TOKEN PERSONAL

  // Subir PDF
  const pdfContent = await file.arrayBuffer();
  const pdfBase64 = btoa(
    new Uint8Array(pdfContent)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  await fetch(`https://api.github.com/repos/${repo}/contents/pdfs/${file.name}`, {
    method: "PUT",
    headers: { "Authorization": `token ${token}` },
    body: JSON.stringify({
      message: `Add ${file.name}`,
      content: pdfBase64,
      branch
    })
  });

  // Actualizar catalog.json
  const catalogUrl = `https://api.github.com/repos/${repo}/contents/catalog.json`;
  const res = await fetch(catalogUrl, { headers: { "Authorization": `token ${token}` } });
  const catalogData = await res.json();
  const catalog = JSON.parse(atob(catalogData.content));

  catalog.push(metadata);

  const newCatalogContent = btoa(JSON.stringify(catalog, null, 2));

  await fetch(catalogUrl, {
    method: "PUT",
    headers: { "Authorization": `token ${token}` },
    body: JSON.stringify({
      message: `Update catalog.json with ${file.name}`,
      content: newCatalogContent,
      sha: catalogData.sha,
      branch
    })
  });

  alert("✅ PDF subido y catalog.json actualizado");
  loadCatalog();
}

loadCatalog();
