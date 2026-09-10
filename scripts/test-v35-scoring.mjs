// Compatibility entry point: exercise production scoring rather than a copied formula.
import { loadModule } from './test-module-loader.mjs'
loadModule('src/services/recommendations/v35/test.ts', { globals: { console } }).runScoringTests()
