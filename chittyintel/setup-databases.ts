import { setupProductionDatabases } from './server/database-schema.ts';

async function runSetup() {
  try {
    console.log('🚀 Setting up ChittyIntel production databases...');
    const result = await setupProductionDatabases();
    
    if (result) {
      console.log('✅ Production databases successfully initialized with ARIBIA legal intelligence data');
      console.log('📊 ChittyIntel is now connected to:');
      console.log('   - ChittyChain Production Database (Corporate & Legal Events)');
      console.log('   - ChittyFinance Production Database (Loan Records & Transactions)');
      console.log('   - Arias v Bianchi Case Database (Litigation Timeline & Court Records)');
      process.exit(0);
    } else {
      console.error('❌ Database setup failed - check connection strings and permissions');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Database setup error:', error);
    process.exit(1);
  }
}

runSetup();