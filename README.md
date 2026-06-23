# CodeVector Backend Task

This repository contains my submission for the CodeVector backend internship task.

## Live Demo
- **Backend/Frontend URL:** [Insert your live URL here]
- **Database:** PostgreSQL (Hosted on [Neon/Supabase])

## How to Run Locally
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Create a `.env` file and add your PostgreSQL connection string: `DATABASE_URL=postgres://...`
4. Run `node seed.js` to generate 200,000 products in a few seconds.
5. Run `node server.js` to start the backend and frontend.
6. Open `http://localhost:3000` in your browser.

---

## Submission Notes

### What I Chose and Why
- **Tech Stack:** I chose Node.js with Express and a raw PostgreSQL driver (`pg`). I opted for raw SQL over an ORM because it allowed me to write and explicitly optimize the exact cursor pagination queries and bulk insert commands needed for this task. It keeps the codebase lightweight and highly performant.
- **Pagination Strategy:** I implemented **Cursor-Based Pagination (Keyset Pagination)**. The task explicitly required that if 50 new products are added while browsing, the user must not see duplicates or miss items. Standard `OFFSET/LIMIT` pagination fails this requirement because the data shifts. Using a cursor based on `(created_at, id)` ensures we always fetch items strictly older than the last seen item, regardless of new inserts. PostgreSQL's tuple comparison `WHERE (created_at, id) < ($1, $2)` makes this logic extremely elegant and fast.
- **Database Indexing:** To make querying 200,000 rows fast, I created composite indexes: `(category, created_at DESC, id DESC)`. This allows the database to jump directly to the requested category and read the pre-sorted data instantly without scanning the whole table.
- **Fast Seeding:** Generating 200,000 individual `INSERT` statements in a loop is too slow. Instead, my `seed.js` script chunks the data into batches of 10,000 and uses bulk insert strings. This seeds the entire database in just a few seconds.
- **Frontend Design:** I built a simple, premium-feeling static HTML/CSS UI using a dark mode aesthetic, glassmorphism elements, and CSS grid to beautifully present the paginated data.

### What I'd Improve With More Time
- **Transactions:** I would wrap the bulk inserts in the seed script inside a database transaction (`BEGIN` / `COMMIT`) so that if a batch fails midway, the database isn't left in a partially seeded state.
- **API Validation:** I would use a library like `Zod` or `Joi` to strictly validate the query parameters (e.g., ensuring `limit` is a number and `category` is a valid string).
- **Caching:** For the first page load of "All Categories" (which is requested the most), I would add a lightweight caching layer (like Redis) with a short TTL to reduce database load.

### How I Used AI
- **What it helped with:** I used AI to help draft the boilerplate Express setup and to design the CSS for the frontend UI. It was very helpful in generating the exact CSS needed for the dark-mode and glassmorphism effects, saving me a lot of time on CSS tweaking.
- **What it got wrong/What I caught:** Initially, when discussing pagination, standard offset pagination is often the default AI response. I had to ensure the architecture strictly followed cursor-based pagination to satisfy the real-time data integrity requirement. Additionally, I had to ensure the seeding script batched the SQL inserts correctly, as AI sometimes suggests simple `for` loops with individual `INSERT` statements that would take far too long for 200k records.
