import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "appdb",
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeBook(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    borrowedBy: row.borrowed_by ?? "",
    borrowedSince: row.borrowed_since ?? "",
    coverUrl: row.cover_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeInput(input) {
  const title = String(input.title ?? "").trim();
  const author = String(input.author ?? "").trim();
  const status = input.status === "kolcsonben" ? "kolcsonben" : "otthon";

  if (!title) throw new Error("A cím kötelező.");
  if (!author) throw new Error("Az író kötelező.");

  let borrowedBy = String(input.borrowedBy ?? input.borrowed_by ?? "").trim();
  let borrowedSince = String(
    input.borrowedSince ?? input.borrowed_since ?? "",
  ).trim();

  // Új mező: coverUrl
  let coverUrl = "";
  if (typeof input.coverUrl === "string") {
    coverUrl = input.coverUrl.trim();
    if (coverUrl.length > 500) {
      throw new Error("A borítókép URL túl hosszú.");
    }
  } else if (typeof input.cover_url === "string") {
    coverUrl = input.cover_url.trim();
    if (coverUrl.length > 500) {
      throw new Error("A borítókép URL túl hosszú.");
    }
  }

  if (status === "otthon") {
    borrowedBy = "";
    borrowedSince = "";
  } else {
    if (!borrowedBy) {
      throw new Error("Kölcsönben státusznál a 'Kinél van' kötelező.");
    }
    if (!borrowedSince) borrowedSince = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  return { title, author, status, borrowedBy, borrowedSince, coverUrl };
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('otthon','kolcsonben')),
      borrowed_by TEXT,
      borrowed_since TEXT,
      cover_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Add cover_url column if it doesn't exist (idempotens, nem törik meg ha már létezik)
  try {
    await pool.query(
      `ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;`,
    );
  } catch (e) {
    // ignore if already exists or not supported
  }

  await pool.query(
    `CREATE INDEX IF NOT EXISTS books_updated_at_idx ON books (updated_at DESC);`,
  );
}

export async function listBooks() {
  const { rows } = await pool.query(`
    SELECT *
    FROM books
    ORDER BY updated_at DESC, id DESC
  `);
  return rows.map(normalizeBook);
}

export async function getBook(id) {
  const { rows } = await pool.query(`SELECT * FROM books WHERE id = $1`, [id]);
  return normalizeBook(rows[0] ?? null);
}

export async function createBook(input) {
  const ts = nowIso();
  const data = sanitizeInput(input);

  const { rows } = await pool.query(
    `
    INSERT INTO books (title, author, status, borrowed_by, borrowed_since, cover_url, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      data.title,
      data.author,
      data.status,
      data.borrowedBy,
      data.borrowedSince,
      data.coverUrl,
      ts,
      ts,
    ],
  );

  return normalizeBook(rows[0]);
}

export async function updateBook(id, input) {
  const existing = await getBook(id);
  if (!existing) return null;

  const ts = nowIso();
  const data = sanitizeInput({ ...existing, ...input });

  const { rows } = await pool.query(
    `
    UPDATE books
    SET title = $1,
        author = $2,
        status = $3,
        borrowed_by = $4,
        borrowed_since = $5,
        cover_url = $6,
        updated_at = $7
    WHERE id = $8
    RETURNING *
    `,
    [
      data.title,
      data.author,
      data.status,
      data.borrowedBy,
      data.borrowedSince,
      data.coverUrl,
      ts,
      id,
    ],
  );

  return normalizeBook(rows[0] ?? null);
}

export async function deleteBook(id) {
  const { rowCount } = await pool.query(`DELETE FROM books WHERE id = $1`, [
    id,
  ]);
  return rowCount > 0;
}
