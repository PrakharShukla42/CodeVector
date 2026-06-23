require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Serve the static frontend UI
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const { limit = 20, cursor, category } = req.query;
    const parsedLimit = parseInt(limit, 10);
    
    // Prevent huge payloads
    if (parsedLimit > 100 || parsedLimit < 1) {
      return res.status(400).json({ error: 'Limit must be between 1 and 100' });
    }

    let queryText = '';
    let values = [];
    let whereClauses = [];
    let paramIndex = 1;

    // 1. Filter by category if provided
    if (category) {
      whereClauses.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    // 2. Cursor Pagination Logic
    // The cursor is passed as a base64 string. We decode it to get the timestamp and ID of the last seen item.
    if (cursor) {
      try {
        const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        const { createdAt, id } = decodedCursor;
        
        // Postgres allows Tuple Comparison!
        // This is strictly faster and handles exact tie-breakers perfectly without skipping or duplicating data.
        whereClauses.push(`(created_at, id) < ($${paramIndex}, $${paramIndex + 1})`);
        values.push(createdAt, id);
        paramIndex += 2;
      } catch (err) {
        return res.status(400).json({ error: 'Invalid cursor format' });
      }
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    queryText = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ${whereString}
      ORDER BY created_at DESC, id DESC
      LIMIT $${paramIndex}
    `;
    values.push(parsedLimit);

    const result = await pool.query(queryText, values);
    const products = result.rows;

    // 3. Prepare the next cursor
    let nextCursor = null;
    // If we fetched exactly the limit, there might be more data
    if (products.length === parsedLimit) {
      const lastProduct = products[products.length - 1];
      const nextCursorData = {
        createdAt: lastProduct.created_at,
        id: lastProduct.id
      };
      nextCursor = Buffer.from(JSON.stringify(nextCursorData)).toString('base64');
    }

    res.json({
      data: products,
      nextCursor
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
