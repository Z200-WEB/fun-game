/**
 * Script to copy shared constants for deployment
 * This ensures the shared folder is available when deploying backend-only
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendRoot = join(__dirname, '..');
const sharedSource = join(backendRoot, '..', 'shared');
const sharedDest = join(backendRoot, 'shared');

// Check if shared folder already exists in backend
if (existsSync(sharedDest)) {
  console.log('Shared folder already exists in backend, skipping copy.');
  process.exit(0);
}

// Check if source shared folder exists
if (!existsSync(sharedSource)) {
  console.log('No shared source folder found at:', sharedSource);
  console.log('This is expected when deploying from backend folder only.');
  console.log('Make sure shared/constants.js exists in the backend folder.');
  process.exit(0);
}

// Create destination folder
mkdirSync(sharedDest, { recursive: true });

// Copy all files from shared
const files = readdirSync(sharedSource);
for (const file of files) {
  const srcPath = join(sharedSource, file);
  const destPath = join(sharedDest, file);
  copyFileSync(srcPath, destPath);
  console.log(`Copied: ${file}`);
}

console.log('Shared folder copied successfully!');
