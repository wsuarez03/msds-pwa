const fs = require("fs");
const path = require("path");

const pdfDir = path.join(__dirname, "public/pdf");
const catalogFile = path.join(__dirname, "public/catalog.json");

const files = fs.readdirSync(pdfDir).filter(f => f.endsWith(".pdf"));
const catalog = files.map(f => ({
  name: f,
  url: `/pdf/${f}`
}));

fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2));
console.log("catalog.json generado con", catalog.length, "archivos.");
