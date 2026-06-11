import { loadCatalogFromDocs, validateCatalog } from '../src/lib/catalog/catalog-parser.mjs';

const catalog = loadCatalogFromDocs(process.cwd());
const issues = validateCatalog(catalog);

console.log(
  JSON.stringify(
    {
      meats: catalog.meats.length,
      equipment: catalog.equipment.length,
      seasonings: catalog.seasonings.length,
      weightProfiles: catalog.weightProfiles.length,
      issues
    },
    null,
    2
  )
);

if (issues.length) {
  process.exit(1);
}
