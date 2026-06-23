require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home', 'Books', 'Toys', 
  'Sports', 'Beauty', 'Health', 'Automotive', 'Grocery'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Creating products table and indexes...');
    
    // We use gen_random_uuid() which is a built-in Postgres function
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Crucial indexes for fast cursor-based pagination
      CREATE INDEX IF NOT EXISTS idx_products_category_pagination 
      ON products(category, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_products_pagination_no_filter 
      ON products(created_at DESC, id DESC);
    `);

    console.log('Checking existing row count...');
    const countRes = await client.query('SELECT COUNT(*) FROM products');
    const count = parseInt(countRes.rows[0].count, 10);
    
    if (count >= 200000) {
      console.log(`Database already has ${count} products. Skipping seed.`);
      return;
    }

    const totalProducts = 200000;
    // Postgres limits parameterized queries to ~65,000 parameters.
    // We have 4 parameters per row, so max ~16,000 rows per insert.
    const batchSize = 10000; 
    const batches = Math.ceil(totalProducts / batchSize);

    console.log(`Starting to seed ${totalProducts} products in ${batches} batches of ${batchSize}...`);
    console.time('Seed Time');

    let totalInserted = 0;
    for (let i = 0; i < batches; i++) {
      const values = [];
      const rows = [];
      
      let paramIndex = 1;
      for (let j = 0; j < batchSize; j++) {
        const name = `Product ${totalInserted + j + 1}`;
        const category = getRandomItem(CATEGORIES);
        const price = (Math.random() * 1000).toFixed(2);
        
        // We stagger created_at up to 30 days ago to simulate realistic data.
        // Multiple products might have the exact same timestamp, which proves our (timestamp, id) cursor works!
        const hoursAgo = Math.floor(Math.random() * 24 * 30); 
        const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

        // Parameterized values: ($1, $2, $3, $4, $4)
        rows.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 3})`);
        values.push(name, category, price, createdAt);
        paramIndex += 4;
      }

      // Single bulk insert statement per 10,000 rows
      const query = `
        INSERT INTO products (name, category, price, created_at, updated_at) 
        VALUES ${rows.join(', ')}
      `;

      await client.query(query, values);
      totalInserted += batchSize;
      console.log(`Inserted batch ${i + 1}/${batches} (${totalInserted} products total)...`);
    }

    console.timeEnd('Seed Time');
    console.log('Seeding completed successfully!');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
