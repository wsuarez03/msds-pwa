// updateCatalog.js
import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

async function main() {
  const id = await ask("ID único del producto: ");
  const name = await ask("Nombre del producto: ");
  const filename = await ask("Nombre del archivo PDF (ej. producto1.pdf): ");
  const version = await ask("Versión: ");
  const date = new Date().toISOString();

  const catalogPath = "./catalog.json";
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  catalog.push({ id, name, filename, version, date });

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log("✅ catalog.json actualizado");
  rl.close();
}

main();
