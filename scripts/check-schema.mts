import { PGlite } from '@electric-sql/pglite';
import { migrations, ACHIEVEMENT_SEED } from '../server/src/pg/migrations.ts';

const db = new PGlite();
for (const m of migrations) {
  await db.exec(m.sql);
  console.log('migration', m.id, m.name, 'ok');
}
console.log('await insert seed');
await db.query(
  `INSERT INTO achievements (id, code, name, description, milestone_bps, badge, sort_order)
   VALUES ${ACHIEVEMENT_SEED.map((_, i) => `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6},$${i * 7 + 7})`).join(',')}`,
  ACHIEVEMENT_SEED.flatMap((a) => [a.code, a.code, a.name, a.description, a.milestoneBps, a.badge, a.sortOrder]),
);
const res = await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM achievements`);
console.log('achievements', res.rows[0]);

// Trigger behaviour: immutability of the ledger and of frozen snapshots.
const uid = '11111111-1111-4111-8111-111111111111';
await db.query(`INSERT INTO users (id, email, created_at, updated_at) VALUES ($1,$2,$3,$3)`, [uid, 'a@b.se', new Date().toISOString()]);
await db.query(`INSERT INTO savings_goals (id, owner_id, name, target_amount_ore, balance_ore, created_at, updated_at)
  VALUES ('22222222-2222-4222-8222-222222222222',$1,'Test',100000,50000,$2,$2)`, [uid, new Date().toISOString()]);
await db.query(`INSERT INTO savings_movements (id, owner_id, goal_id, type, amount_ore, balance_after_ore, occurred_at, created_at)
  VALUES ('33333333-3333-4333-8333-333333333333',$1,'22222222-2222-4222-8222-222222222222','deposit',50000,50000,$2,$2)`, [uid, new Date().toISOString()]);
try {
  await db.query(`UPDATE savings_movements SET amount_ore = 1`);
  console.log('ERROR: ledger update allowed');
} catch (error) {
  console.log('ledger immutable ->', (error as Error).message.split('\n')[0]);
}
try {
  await db.query(`INSERT INTO transactions (id, owner_id, goal_id, type, amount_ore, category, occurred_at, created_at, updated_at)
    VALUES ('44444444-4444-4444-8444-444444444444', '99999999-9999-4999-8999-999999999999', '22222222-2222-4222-8222-222222222222','income',100,'Lön',$1,$1,$1)`, [new Date().toISOString()]);
  console.log('ERROR: foreign goal allowed');
} catch (error) {
  console.log('goal owner guard ->', (error as Error).message.split('\n')[0]);
}
const iso = await db.query<{ month: string }>(`SELECT left(occurred_at, 7) AS month FROM savings_movements LIMIT 1`);
console.log('month extraction', iso.rows[0]);
const sum = await db.query<{ total: number }>(`SELECT COALESCE(SUM(amount_ore), 0)::bigint AS total FROM savings_movements`);
console.log('sum type', typeof sum.rows[0]!.total, sum.rows[0]);
