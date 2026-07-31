import AdmZip from 'adm-zip';
import fs from 'fs';

function fail(msg) {
  console.error(msg);
  process.exit(4);
}

function normalizeText(text) {
  return text.toLowerCase();
}

function getSortedMatchingEntries(entries, regex) {
  return entries
    .filter((entry) => regex.test(entry.entryName))
    .sort((left, right) => left.entryName.localeCompare(right.entryName, undefined, { numeric: true }));
}

function decodeTextEntry(entry) {
  return entry.getData().toString('utf8');
}

const pptxPath = process.argv[2] || 'docs/presentation/ResourceApp-TFM-Marcos-Palacios.pptx';
if (!fs.existsSync(pptxPath)) {
  fail(`PPTX not found: ${pptxPath}`);
}

const zip = new AdmZip(pptxPath);
const entries = zip.getEntries();

const slideEntries = getSortedMatchingEntries(entries, /^ppt\/slides\/slide\d+\.xml$/);
const slideRelationshipEntries = getSortedMatchingEntries(entries, /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/);
const notesEntries = getSortedMatchingEntries(entries, /^ppt\/notesSlides\/notesSlide\d+\.xml$/);
const notesRelationshipEntries = getSortedMatchingEntries(entries, /^ppt\/notesSlides\/_rels\/notesSlide\d+\.xml\.rels$/);
const mediaEntries = entries.filter((entry) => /^ppt\/media\/.+/.test(entry.entryName));
const textEntries = entries.filter(
  (entry) => entry.entryName === '[Content_Types].xml' || /\.(xml|rels|txt)$/i.test(entry.entryName),
);

console.log(
  'slides:',
  slideEntries.length,
  'slideRels:',
  slideRelationshipEntries.length,
  'notes:',
  notesEntries.length,
  'media:',
  mediaEntries.length,
  'textEntries:',
  textEntries.length,
);

const requiredSlides = 20;
const minimumImages = 9;
if (slideEntries.length !== requiredSlides) {
  fail(`Expected ${requiredSlides} slides but found ${slideEntries.length}`);
}

if (slideRelationshipEntries.length !== requiredSlides) {
  fail(`Expected ${requiredSlides} slide relationships but found ${slideRelationshipEntries.length}`);
}

if (notesEntries.length !== requiredSlides) {
  fail(`Expected ${requiredSlides} notes slides but found ${notesEntries.length}`);
}

if (notesRelationshipEntries.length !== requiredSlides) {
  fail(`Expected ${requiredSlides} notes relationships but found ${notesRelationshipEntries.length}`);
}

if (mediaEntries.length < minimumImages) {
  fail(`Expected at least ${minimumImages} embedded images in ppt/media but found ${mediaEntries.length}`);
}

const requiredTitles = [
  'Introducción',
  'Especificación funcional',
  'Especificación técnica',
  'Despliegue y entorno productivo'
];
const slideXmls = slideEntries.map((entry) => decodeTextEntry(entry));
const foundTitles = new Set();
for (const xml of slideXmls) {
  for (const t of requiredTitles) {
    if (xml.includes(t)) foundTitles.add(t);
  }
}

if (foundTitles.size < 4) {
  fail(`Expected at least 4 section titles (${requiredTitles.join(', ')}) but found ${[...foundTitles].join(', ')}`);
}

const forbiddenPatterns = ['sk-', 'password=', 'resources_pass', 'root_password'];
const hits = [];

for (const entry of textEntries) {
  const text = normalizeText(decodeTextEntry(entry));
  for (const pattern of forbiddenPatterns) {
    if (text.includes(pattern)) {
      hits.push(`${pattern} in ${entry.entryName}`);
    }
  }
}

if (hits.length > 0) {
  fail(`Forbidden secret-like content found: ${hits.join('; ')}`);
}

console.log('PASS: 20 slides, notes, media and required sections validated');
process.exit(0);
