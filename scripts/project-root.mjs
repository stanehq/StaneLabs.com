import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve from the module location, independently of the caller's directory.
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
