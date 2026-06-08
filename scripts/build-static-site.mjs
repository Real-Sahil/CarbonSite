import { cp, mkdir, rm } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
const publicDirectory = new URL('../public/', import.meta.url);
const docsDirectory = new URL('../docs/', import.meta.url);
const outputDocsDirectory = new URL('../dist/docs/', import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(publicDirectory, outputDirectory, { recursive: true });
await mkdir(outputDocsDirectory, { recursive: true });
await cp(docsDirectory, outputDocsDirectory, { recursive: true });

console.log('Built static CarbonSite assets into dist/.');
