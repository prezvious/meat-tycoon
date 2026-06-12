import fs from 'node:fs';
import path from 'node:path';
import {
  formatExtraMeatCookingPreviewMarkdown,
  loadExtraMeatCookingPreview
} from '../src/lib/catalog/catalog-parser.mjs';

function optionValue(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : undefined;
}

const cookingTimingSeed = optionValue('--seed') ?? process.env.COOKING_TIMING_SEED ?? `preview-${Date.now()}`;
const outputPath = optionValue('--output') ?? 'extra-meat-cooking-times-preview.md';
const previewRows = loadExtraMeatCookingPreview(process.cwd(), { cookingTimingSeed });
const markdown = formatExtraMeatCookingPreviewMarkdown(previewRows, { cookingTimingSeed });

if (process.argv.includes('--write')) {
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), markdown);
  console.log(
    JSON.stringify(
      {
        status: 'written',
        outputPath,
        rows: previewRows.length,
        cookingTimingSeed
      },
      null,
      2
    )
  );
} else {
  process.stdout.write(markdown);
}
