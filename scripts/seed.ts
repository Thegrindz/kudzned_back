import { AppDataSource } from '../src/database/data-source';
import { seedCategories } from '../src/database/seeds/categories.seed';

async function runSeeds() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    console.log('Running seeds...');
    await seedCategories(AppDataSource);

    console.log('Seeds completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error running seeds:', error);
    process.exit(1);
  }
}

runSeeds();