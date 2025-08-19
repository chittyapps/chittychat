import { 
  chittyChainDB, 
  chittyFinanceDB, 
  ariasVBianchiDB 
} from './database-connections';

// Database schema initialization for ChittyIntel production data
export async function initializeDatabaseSchemas() {
  console.log('🔄 Initializing ChittyIntel database schemas...');

  try {
    // ChittyChain Database Schema
    await chittyChainDB.query(`
      CREATE TABLE IF NOT EXISTS legal_events (
        id SERIAL PRIMARY KEY,
        event_title VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        description TEXT,
        event_type VARCHAR(50),
        entity_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await chittyChainDB.query(`
      CREATE TABLE IF NOT EXISTS legal_perspectives (
        id SERIAL PRIMARY KEY,
        case_reference VARCHAR(100) NOT NULL,
        perspective_name VARCHAR(50) NOT NULL,
        analysis_content TEXT,
        strength_score INTEGER CHECK (strength_score >= 0 AND strength_score <= 100),
        key_points JSONB,
        risk_factors JSONB,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ChittyFinance Database Schema
    await chittyFinanceDB.query(`
      CREATE TABLE IF NOT EXISTS active_loans (
        loan_id VARCHAR(50) PRIMARY KEY,
        principal_amount DECIMAL(15,2) NOT NULL,
        interest_rate DECIMAL(5,4) NOT NULL,
        current_status VARCHAR(50),
        borrower_entity VARCHAR(100),
        lender_name VARCHAR(100),
        origination_date DATE,
        maturity_date DATE,
        last_payment_date DATE,
        outstanding_balance DECIMAL(15,2),
        payment_history JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await chittyFinanceDB.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        transaction_id SERIAL PRIMARY KEY,
        entity_id VARCHAR(50),
        transaction_type VARCHAR(50),
        transaction_date DATE NOT NULL,
        amount DECIMAL(15,2),
        memo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Arias v Bianchi Database Schema
    await ariasVBianchiDB.query(`
      CREATE TABLE IF NOT EXISTS active_cases (
        case_id VARCHAR(50) PRIMARY KEY,
        case_number VARCHAR(50) UNIQUE,
        court_name VARCHAR(200),
        filing_date DATE,
        case_status VARCHAR(50),
        petitioner_name VARCHAR(100),
        respondent_name VARCHAR(100),
        case_type VARCHAR(50),
        judge_assigned VARCHAR(100),
        last_activity_date DATE,
        next_hearing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await ariasVBianchiDB.query(`
      CREATE TABLE IF NOT EXISTS case_timeline (
        id SERIAL PRIMARY KEY,
        case_id VARCHAR(50) REFERENCES active_cases(case_id),
        case_event VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        event_description TEXT,
        case_number VARCHAR(50),
        court_name VARCHAR(200),
        filed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database schemas initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Schema initialization failed:', error);
    return false;
  }
}

// Populate with initial ARIBIA LLC legal intelligence data
export async function seedInitialData() {
  console.log('🌱 Seeding initial legal intelligence data...');

  try {
    // Seed ChittyChain legal events
    await chittyChainDB.query(`
      INSERT INTO legal_events (event_title, event_date, description, event_type, entity_name) VALUES
      ('ARIBIA LLC Formation', '2022-08-01', 'Operating Agreement executed with initial members', 'formation', 'ARIBIA LLC'),
      ('Member Amendment - Luisa Exit', '2023-05-09', 'Luisa Arias temporary exit for international compliance', 'member_change', 'ARIBIA LLC'),
      ('Member Readmission - Sharon Jones', '2024-03-15', 'Sharon Jones reinstated as 5% member via unanimous consent', 'member_change', 'ARIBIA LLC'),
      ('Operating Agreement Amendment', '2024-10-29', 'Major amendments to ARIBIA LLC governance structure', 'governance', 'ARIBIA LLC')
      ON CONFLICT DO NOTHING;
    `);

    // Seed legal perspectives analysis
    await chittyChainDB.query(`
      INSERT INTO legal_perspectives (case_reference, perspective_name, analysis_content, strength_score, key_points, risk_factors) VALUES
      ('ARIBIA_LITIGATION_2024', 'aribia', 'ARIBIA LLC has strong business defense position based on proper governance and legitimate business operations', 85, 
       '["Valid operating agreements", "Proper member procedures", "Business continuity focus"]', 
       '["TRO restrictions", "Member disputes", "Operational limitations"]'),
      ('ARIBIA_LITIGATION_2024', 'sharon', 'Lender perspective focuses on loan security and member rights as 5% owner and company president', 78,
       '["Secured loan position", "Member voting rights", "Executive authority"]',
       '["Litigation impact", "Business disruption", "Asset accessibility"]'),
      ('ARIBIA_LITIGATION_2024', 'luisa', 'Former member claims based on historical ownership and participation in company formation', 65,
       '["Historical ownership", "Formation participation", "Financial contributions"]',
       '["Legal exit procedures", "Documentation requirements", "Time limitations"]')
      ON CONFLICT DO NOTHING;
    `);

    // Seed ChittyFinance loan data
    await chittyFinanceDB.query(`
      INSERT INTO active_loans (loan_id, principal_amount, interest_rate, current_status, borrower_entity, lender_name, origination_date, maturity_date, outstanding_balance, payment_history) VALUES
      ('JONES_ARIBIA_2024', 100000.00, 0.0466, 'Active - Under TRO', 'ARIBIA LLC', 'Sharon Elizabeth Jones', '2024-05-28', '2033-06-01', 97060.37,
       '[{"date": "2024-07-01", "amount": 1135.40, "type": "scheduled_payment"}, {"date": "2024-08-01", "amount": 1135.40, "type": "scheduled_payment"}]')
      ON CONFLICT DO NOTHING;
    `);

    // Seed financial transactions
    await chittyFinanceDB.query(`
      INSERT INTO financial_transactions (entity_id, transaction_type, transaction_date, amount, memo) VALUES
      ('ARIBIA_LLC', 'Loan Disbursement', '2024-05-28', 97060.37, 'Initial loan disbursement to ARIBIA LLC'),
      ('ARIBIA_LLC', 'Interest Payment', '2024-07-01', 1135.40, 'Monthly loan payment - principal and interest'),
      ('ARIBIA_LLC', 'Interest Payment', '2024-08-01', 1135.40, 'Monthly loan payment - principal and interest'),
      ('ARIBIA_LLC', 'TRO Impact', '2024-10-31', 0.00, 'Loan payments suspended due to TRO restraining order')
      ON CONFLICT DO NOTHING;
    `);

    // Seed Arias v Bianchi case data
    await ariasVBianchiDB.query(`
      INSERT INTO active_cases (case_id, case_number, court_name, filing_date, case_status, petitioner_name, respondent_name, case_type, judge_assigned, last_activity_date) VALUES
      ('ARIAS_V_BIANCHI_2024', '2024D007847', 'Circuit Court of Cook County - Domestic Relations', '2024-10-31', 'Active - TRO in Effect', 'Luisa Fernanda Arias Montealegre', 'Nicholas Bianchi', 'Business Dispute', 'Hon. Robert W. Johnson', '2024-10-31')
      ON CONFLICT DO NOTHING;
    `);

    // Seed case timeline events
    await ariasVBianchiDB.query(`
      INSERT INTO case_timeline (case_id, case_event, event_date, event_description, case_number, court_name) VALUES
      ('ARIAS_V_BIANCHI_2024', 'TRO Petition Filed', '2024-10-31', 'Emergency petition for temporary restraining order against business operations', '2024D007847', 'Circuit Court of Cook County'),
      ('ARIAS_V_BIANCHI_2024', 'TRO Granted', '2024-10-31', 'Court grants temporary restraining order restraining ARIBIA LLC business operations', '2024D007847', 'Circuit Court of Cook County'),
      ('ARIAS_V_BIANCHI_2024', 'Emergency Motion Filed', '2025-06-09', 'Emergency motion to modify or dissolve TRO based on business necessity', '2024D007847', 'Circuit Court of Cook County')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Initial legal intelligence data seeded successfully');
    return true;
  } catch (error) {
    console.error('❌ Data seeding failed:', error);
    return false;
  }
}

// Initialize complete database setup
export async function setupProductionDatabases() {
  const schemaSuccess = await initializeDatabaseSchemas();
  if (schemaSuccess) {
    const seedSuccess = await seedInitialData();
    return seedSuccess;
  }
  return false;
}