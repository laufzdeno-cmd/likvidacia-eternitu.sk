const [id, title] = process.argv.slice(2);
const db = await import(`../src/server/db.ts?admin-work-item-worker=${process.pid}`);
const actor = 'admin@local.test';

try {
  await db.updateAdminWorkItem(id, {
    title,
    note: 'Súbežná úprava z oddeleného Node procesu.',
    priority: 'NORMAL',
    dueDate: '2026-10-14',
    ownerEmail: actor,
    visibility: 'TEAM',
  }, 1, actor, 'SUPER_ADMIN');
  console.log('SUCCESS');
} catch (error) {
  if (error instanceof Error && error.message.includes('medzičasom')) console.log('STALE');
  else throw error;
}
