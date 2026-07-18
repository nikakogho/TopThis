import { PrivateService } from '../dist/private.js';
import { PracticeService } from '../dist/practice.js';

// This runs under Node's native ESM loader, rather than Vitest's transform.
// It catches missing JSON import attributes in the emitted production modules.
new PracticeService({ seed: 1 }).close();
new PrivateService({ seed: 1 }).close();
