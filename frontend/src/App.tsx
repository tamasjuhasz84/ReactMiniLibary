import React, { useEffect, useMemo, useState } from "react";
import ".//styles/App.css";

type BookStatus = "otthon" | "kolcsonben";

type Book = {
  id: number | string;
  title: string;
  author: string;
  status: BookStatus;
  borrowedBy?: string | null;
  borrowedSince?: string | null;
};

type BookForm = {
  title: string;
  author: string;
  status: BookStatus;
  borrowedBy: string;
  borrowedSince: string;
};

const BASE_URL = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE_URL + url, opts);
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data?.error || "Hiba történt.");
  return data as T;
}

const emptyForm: BookForm = {
  title: "",
  author: "",
  status: "otthon",
  borrowedBy: "",
  borrowedSince: "",
};

export default function MiniReactLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const [editingId, setEditingId] = useState<Book["id"] | null>(null);
  const [form, setForm] = useState<BookForm>({ ...emptyForm });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return books;
    return books.filter((b) => {
      const bb = (b.borrowedBy ?? "").toLowerCase();
      return (
        b.title.toLowerCase().includes(s) ||
        b.author.toLowerCase().includes(s) ||
        bb.includes(s)
      );
    });
  }, [books, q]);

  async function load() {
    setError("");
    setInfo("");
    const data = await api<Book[]>("/api/books");
    setBooks(data);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function edit(b: Book) {
    setEditingId(b.id);
    setForm({
      title: b.title,
      author: b.author,
      status: b.status,
      borrowedBy: (b.borrowedBy ?? "") as string,
      borrowedSince: (b.borrowedSince ?? "") as string,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e?: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    e?.preventDefault();
    setError("");
    setInfo("");

    try {
      const payload: BookForm = { ...form };

      if (payload.status === "kolcsonben" && !payload.borrowedSince) {
        payload.borrowedSince = new Date().toISOString().slice(0, 10);
      }

      if (editingId !== null) {
        await api(`/api/books/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setInfo("Mentve.");
      } else {
        await api(`/api/books`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setInfo("Hozzáadva.");
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt.");
    }
  }

  async function removeBook(id: Book["id"]) {
    setError("");
    setInfo("");
    if (!window.confirm("Biztos törlöd?")) return;

    try {
      await api(`/api/books/${id}`, { method: "DELETE" });
      setInfo("Törölve.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt.");
    }
  }

  async function markReturned(b: Book) {
    setError("");
    setInfo("");

    try {
      await api(`/api/books/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: b.title,
          author: b.author,
          status: "otthon",
          borrowedBy: "",
          borrowedSince: "",
        }),
      });
      setInfo("Visszavéve (otthon).");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (form.status === "otthon") {
      setForm((prev) => ({ ...prev, borrowedBy: "", borrowedSince: "" }));
    }
  }, [form.status]);

  return (
    <div>
      <div className="topbar">
        <h1>Otthoni Könyvtár</h1>
      </div>

      <div className="card">
        <h2>{editingId ? "Könyv szerkesztése" : "Új könyv"}</h2>

        <form onSubmit={save}>
          <div className="row">
            <input
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="Cím"
              className="input-wide"
            />
            <input
              value={form.author}
              onChange={(e) =>
                setForm((p) => ({ ...p, author: e.target.value }))
              }
              placeholder="Író"
              className="input-wide"
            />
            <select
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as BookStatus }))
              }
            >
              <option value="otthon">Otthon</option>
              <option value="kolcsonben">Kölcsönben</option>
            </select>
          </div>

          {form.status === "kolcsonben" && (
            <div className="row">
              <input
                value={form.borrowedBy}
                onChange={(e) =>
                  setForm((p) => ({ ...p, borrowedBy: e.target.value }))
                }
                placeholder="Kinél van?"
                className="input-wide"
              />
              <input
                value={form.borrowedSince}
                onChange={(e) =>
                  setForm((p) => ({ ...p, borrowedSince: e.target.value }))
                }
                type="date"
                className="date"
              />
              <div className="muted borrowed-hint">
                Ha a “Mióta” üres, automatikusan a mai dátumot kapja.
              </div>
            </div>
          )}

          <div className="row">
            <button type="submit">{editingId ? "Mentés" : "Hozzáadás"}</button>
            {(form.title !== "" || form.author !== "") && (
              <button type="button" onClick={resetForm}>
                Mégse
              </button>
            )}
          </div>
        </form>

        {error && <p className="danger">{error}</p>}
        {info && <p>{info}</p>}
      </div>

      <div className="card">
        <div className="row">
          <h2>Könyvek</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Keresés (cím/író/kinél)"
            className="search"
          />
        </div>

        {filtered.length ? (
          <table>
            <thead>
              <tr>
                <th>Cím</th>
                <th>Író</th>
                <th>Státusz</th>
                <th>Részletek</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((b) => (
                <tr key={String(b.id)}>
                  <td>{b.title}</td>
                  <td>{b.author}</td>
                  <td>{b.status === "otthon" ? "Otthon" : "Kölcsönben"}</td>
                  <td>
                    {b.status === "kolcsonben" ? (
                      <span>
                        {(b.borrowedBy ?? "") as string} •{" "}
                        {(b.borrowedSince ?? "") as string}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="actions">
                    {b.status === "kolcsonben" && (
                      <button type="button" onClick={() => markReturned(b)}>
                        Visszahozva
                      </button>
                    )}

                    <button type="button" onClick={() => edit(b)}>
                      Szerkeszt
                    </button>
                    <button type="button" onClick={() => removeBook(b.id)}>
                      Töröl
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nincs még könyv rögzítve.</p>
        )}
      </div>
    </div>
  );
}
