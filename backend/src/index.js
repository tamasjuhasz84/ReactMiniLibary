import "dotenv/config";
import express from "express";
import cors from "cors";

import { initDb, listBooks, createBook, updateBook, deleteBook } from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

await initDb();

app.get("/api/books", async (req, res, next) => {
  try {
    res.json(await listBooks());
  } catch (e) {
    next(e);
  }
});

app.post("/api/books", async (req, res) => {
  try {
    res.status(201).json(await createBook(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || "Hiba" });
  }
});

app.put("/api/books/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await updateBook(id, req.body);
    if (!updated) return res.status(404).json({ error: "Nincs ilyen könyv." });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message || "Hiba" });
  }
});

app.delete("/api/books/:id", async (req, res, next) => {
  try {
    const ok = await deleteBook(Number(req.params.id));
    res.json({ ok });
  } catch (e) {
    next(e);
  }
});

app.post("/api/shutdown", (req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
