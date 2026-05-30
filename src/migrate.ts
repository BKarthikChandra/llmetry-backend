import 'reflect-metadata';
import { AppDataSource } from './config/database.config';

async function runMigrations(): Promise<void> {
  console.log('Connecting to database...');
  await AppDataSource.initialize();

  console.log('Running pending migrations...');
  const applied = await AppDataSource.runMigrations();

  if (applied.length === 0) {
    console.log('No pending migrations — schema is up to date.');
  } else {
    console.log(`Applied ${applied.length} migration(s):`);
    applied.forEach((m) => console.log(`  ✓ ${m.name}`));
  }

  await AppDataSource.destroy();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
