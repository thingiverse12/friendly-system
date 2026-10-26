// Tilldelar en användare moderator- eller administratörsrollen.
// Användning: node --experimental-sqlite scripts/make-mod.mjs <användarnamn> [moderator|admin]
import { run, getOne } from '../server/src/db.js';

const username = process.argv[2];
const role = process.argv[3] === 'admin' ? 'admin' : 'moderator';
if (!username) {
  console.error('Användning: node --experimental-sqlite scripts/make-mod.mjs <användarnamn> [moderator|admin]');
  process.exit(1);
}
const user = getOne('SELECT id, role FROM users WHERE username = ?', [username.toLowerCase()]);
if (!user) {
  console.error(`Användaren "${username}" finns inte.`);
  process.exit(1);
}
run('UPDATE users SET role = ? WHERE id = ?', [role, user.id]);
console.log(`Användaren ${username} har nu rollen "${role}" (tidigare: ${user.role}).`);
process.exit(0);
