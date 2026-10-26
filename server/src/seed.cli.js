// Manuell omsådd: npm run seed
import { seedAll } from './seed.js';

seedAll();
// eslint-disable-next-line no-console
console.log('Databasen är fylld med officiellt innehåll och demokonto.');
process.exit(0);
