"use client";

import { useState } from "react";
import { Clock3, ImagePlus, Plus, Trash2 } from "lucide-react";
import { call, useLive } from "@/lib/live";
import { hoursLabel, inr, stationNames } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { Category, MenuItem, Option, Restaurant } from "@/lib/types";
import { DietMark, Sheet } from "../bits";
import { H, Notice } from "./admin-app";

async function load(rid: string) {
  const db = browserClient();
  const [c, i] = await Promise.all([
    db.from("categories").select("*").eq("restaurant_id", rid).order("sort"),
    db.from("menu_items").select("*").eq("restaurant_id", rid).order("sort"),
  ]);
  return { categories: (c.data ?? []) as Category[], items: (i.data ?? []) as MenuItem[] };
}

export function MenuSection({ restaurant: r }: { restaurant: Restaurant }) {
  const { data, reload } = useLive(r.id, ["menu_items"], () => load(r.id));
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const admin = async (body: object, ok?: string) => {
    const { error } = await call("/api/admin", body);
    setMsg(error ?? ok ?? null);
    reload();
    return error;
  };
  if (!data) return <p className="text-muted">Loading the menu…</p>;

  return (
    <>
      <H
        sub="Changes reach every table's phone straight away. Switch a dish off when it runs out."
        action={
          <button type="button" className="btn btn-primary" disabled={!data.categories.length} onClick={() => setEditing({ category_id: data.categories[0]?.id, diet: "veg", spice: 0, station: "kitchen", prep_minutes: 10, tags: [], variants: [], addons: [], available: true })}>
            <Plus className="size-4" aria-hidden="true" />
            Add a dish
          </button>
        }
      >
        Menu
      </H>
      <Notice text={msg} onDone={() => setMsg(null)} />
      {!data.items.length ? (
        <div className="bg-turmeric-tint mb-6 rounded-xl p-5">
          <p className="font-bold">Start from a ready-made Andhra menu?</p>
          <p className="text-ink-2 mt-1 text-sm">About 40 dishes in 8 categories with prices, sizes and extras. Edit or delete anything afterwards.</p>
          <button type="button" className="btn btn-primary mt-3" onClick={() => void admin({ type: "sampleMenu" }, "Starter menu added. Edit prices and dishes to match your restaurant.")}>
            Load the starter menu
          </button>
        </div>
      ) : null}

      <form
        className="mb-6 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newCat.trim()) return;
          if (!(await admin({ type: "category", name: newCat.trim() }, "Category added."))) setNewCat("");
        }}
      >
        <input className="field" placeholder="New category, e.g. Biryani" aria-label="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <button type="submit" className="btn btn-line shrink-0">
          Add category
        </button>
      </form>

      {data.categories.map((c) => {
        const items = data.items.filter((i) => i.category_id === c.id);
        return (
          <section key={c.id} aria-label={c.name} className="mb-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="dish text-xl">
                {c.name} {c.note ? <span className="text-muted text-sm font-normal">{c.note}</span> : null}
              </h2>
              <div className="flex flex-wrap items-center gap-1">
                <Hours category={c} save={(hours) => admin({ type: "category", id: c.id, name: c.name, note: c.note, hours }, hours.from ? `${c.name}: served ${hoursLabel({ available_from: hours.from, available_to: hours.to })}.` : `${c.name}: served all day.`)} />
                <button
                  type="button"
                  className="btn btn-quiet !min-h-9 text-sm"
                  onClick={() => {
                    const name = window.prompt("Category name", c.name);
                    if (name?.trim()) void admin({ type: "category", id: c.id, name: name.trim(), note: c.note });
                  }}
                >
                  Rename
                </button>
                {!items.length ? (
                  <button type="button" className="btn btn-quiet text-madder !min-h-9 text-sm" onClick={() => void admin({ type: "deleteCategory", id: c.id }, "Category deleted.")}>
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
            {items.length ? (
              <ul className="bg-card border-line divide-line mt-2 divide-y rounded-xl border">
                {items.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    {m.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image_url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="bg-ground text-muted flex size-12 shrink-0 items-center justify-center rounded-lg">
                        <ImagePlus className="size-5" aria-hidden="true" />
                      </span>
                    )}
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(m)}>
                      <span className="flex items-center gap-2">
                        <DietMark diet={m.diet} />
                        <span className={`font-bold ${m.available ? "" : "text-muted line-through"}`}>{m.name}</span>
                      </span>
                      <span className="text-muted text-sm">
                        {stationNames[m.station] ?? m.station}
                        {m.variants.length ? `, ${m.variants.length} sizes` : ""}
                        {m.addons.length ? `, ${m.addons.length} extras` : ""}
                      </span>
                    </button>
                    <span className="num shrink-0">{inr(m.price)}</span>
                    <label className="inline-flex min-h-10 shrink-0 items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-indigo size-4" checked={m.available} onChange={() => void call("/api/staff", { type: "available", itemId: m.id, available: !m.available }).then(reload)} />
                      <span className="sr-only">Available: {m.name}</span>
                      <span className={m.available ? "" : "text-madder font-bold"}>{m.available ? "On" : "Sold out"}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-2 text-sm">No dishes yet.</p>
            )}
          </section>
        );
      })}

      {editing ? (
        <ItemEditor
          item={editing}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMsg(text);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function OptionsEditor({ label, value, onChange, hint }: { label: string; value: Option[]; onChange: (v: Option[]) => void; hint: string }) {
  return (
    <fieldset className="mt-4">
      <legend className="label">{label}</legend>
      <p className="text-muted -mt-1 mb-2 text-xs">{hint}</p>
      {value.map((o, i) => (
        <div key={o.id} className="mb-2 flex gap-2">
          <input className="field" aria-label={`${label} name`} value={o.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="field !w-28" aria-label={`${label} price`} inputMode="numeric" value={o.price} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} />
          <button type="button" className="btn btn-quiet !px-2.5" aria-label={`Remove ${o.label || "option"}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-line !min-h-9 text-sm" onClick={() => onChange([...value, { id: Math.random().toString(36).slice(2, 8), label: "", price: 0 }])}>
        <Plus className="size-4" aria-hidden="true" />
        Add
      </button>
    </fieldset>
  );
}

function ItemEditor({ item, categories, onClose, onSaved }: { item: Partial<MenuItem>; categories: Category[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState({
    category_id: item.category_id ?? categories[0]?.id ?? "",
    name: item.name ?? "",
    local_name: item.local_name ?? "",
    description: item.description ?? "",
    price: item.price ?? 0,
    diet: item.diet ?? "veg",
    spice: item.spice ?? 0,
    station: item.station ?? "kitchen",
    prep_minutes: item.prep_minutes ?? 10,
    tags: item.tags ?? [],
    variants: item.variants ?? [],
    addons: item.addons ?? [],
    serves: item.serves ?? null,
    available: item.available ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const { error: err, data } = await call("/api/admin", {
      type: "item",
      item: { ...f, id: item.id, local_name: f.local_name || null, description: f.description || null, variants: f.variants.filter((v) => v.label.trim()), addons: f.addons.filter((a) => a.label.trim()) },
    });
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    const id = item.id ?? (data?.id as string | undefined);
    if (photo && id) {
      const form = new FormData();
      form.set("file", photo);
      form.set("itemId", id);
      const res = await fetch("/api/admin/photo", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "The photo didn't upload.");
        setBusy(false);
        return;
      }
    }
    onSaved(item.id ? `${f.name} saved.` : `${f.name} added to the menu.`);
  };

  return (
    <Sheet
      title={item.id ? `Edit ${item.name}` : "Add a dish"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary flex-1" disabled={busy || !f.name.trim()} onClick={save}>
            {busy ? "Saving…" : "Save dish"}
          </button>
          {item.id ? (
            <button
              type="button"
              className="btn btn-quiet text-madder"
              onClick={async () => {
                if (!window.confirm(`Delete ${item.name} from the menu?`)) return;
                const { error: err } = await call("/api/admin", { type: "deleteItem", id: item.id });
                if (err) setError(err);
                else onSaved(`${item.name} deleted.`);
              }}
            >
              Delete
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="text-madder w-full text-sm font-bold">
              {error}
            </p>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-x-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="e-name">
            Name
          </label>
          <input id="e-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-local">
            Name in Telugu (optional)
          </label>
          <input id="e-local" className="field font-te" value={f.local_name} onChange={(e) => set("local_name", e.target.value)} />
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-cat">
            Category
          </label>
          <select id="e-cat" className="field" value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 sm:col-span-2">
          <label className="label" htmlFor="e-desc">
            Description
          </label>
          <textarea id="e-desc" className="field" rows={2} maxLength={300} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-price">
            Price (₹)
          </label>
          <input id="e-price" className="field" inputMode="numeric" value={f.price} onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-diet">
            Food type
          </label>
          <select id="e-diet" className="field" value={f.diet} onChange={(e) => set("diet", e.target.value as MenuItem["diet"])}>
            <option value="veg">Veg</option>
            <option value="egg">Egg</option>
            <option value="nonveg">Non-veg</option>
          </select>
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-spice">
            Spice
          </label>
          <select id="e-spice" className="field" value={f.spice} onChange={(e) => set("spice", Number(e.target.value))}>
            <option value={0}>Not spicy</option>
            <option value={1}>Mild</option>
            <option value={2}>Spicy</option>
            <option value={3}>Very spicy</option>
          </select>
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-station">
            Made at
          </label>
          <select id="e-station" className="field" value={f.station} onChange={(e) => set("station", e.target.value)}>
            {Object.entries(stationNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-prep">
            Usually ready in (minutes)
          </label>
          <input id="e-prep" className="field" inputMode="numeric" value={f.prep_minutes} onChange={(e) => set("prep_minutes", Number(e.target.value.replace(/\D/g, "")) || 1)} />
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="e-photo">
            Photo (JPG, PNG or WebP, under 3 MB)
          </label>
          <input id="e-photo" type="file" accept="image/jpeg,image/png,image/webp" className="field !py-2" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="label">Labels</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["bestseller", "Bestseller"],
              ["chef", "Chef suggests"],
              ["new", "New"],
            ] as const
          ).map(([k, v]) => (
            <label key={k} className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" className="accent-indigo size-4" checked={f.tags.includes(k)} onChange={(e) => set("tags", e.target.checked ? [...f.tags, k] : f.tags.filter((t) => t !== k))} />
              {v}
            </label>
          ))}
        </div>
      </fieldset>
      <OptionsEditor label="Sizes" hint="Like Half and Full. Each size has its own full price. Leave empty if there's one size." value={f.variants} onChange={(v) => set("variants", v)} />
      <OptionsEditor label="Extras" hint="Added on top of the price, like Extra raita +₹30." value={f.addons} onChange={(v) => set("addons", v)} />
    </Sheet>
  );
}

/** When a menu section is served. Outside these hours guests see it greyed out and can't order it. */
function Hours({ category: c, save }: { category: Category; save: (h: { from: string | null; to: string | null }) => Promise<string | null | undefined> }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(c.available_from?.slice(0, 5) ?? "07:00");
  const [to, setTo] = useState(c.available_to?.slice(0, 5) ?? "11:30");
  const label = hoursLabel(c);
  if (!open) {
    return (
      <button type="button" className="btn btn-quiet !min-h-9 text-sm" onClick={() => setOpen(true)} aria-label={`Serving hours for ${c.name}: ${label ?? "all day"}. Change`}>
        <Clock3 className="size-4" aria-hidden="true" />
        {label ?? "All day"}
      </button>
    );
  }
  return (
    <form
      className="bg-card border-line flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await save({ from, to }))) setOpen(false);
      }}
    >
      <label className="flex items-center gap-1">
        From <input type="time" className="field !h-9 !w-auto !py-0" value={from} onChange={(e) => setFrom(e.target.value)} required />
      </label>
      <label className="flex items-center gap-1">
        to <input type="time" className="field !h-9 !w-auto !py-0" value={to} onChange={(e) => setTo(e.target.value)} required />
      </label>
      <button type="submit" className="btn btn-primary !min-h-9 text-sm">
        Save
      </button>
      <button
        type="button"
        className="btn btn-quiet !min-h-9 text-sm"
        onClick={async () => {
          if (!(await save({ from: null, to: null }))) setOpen(false);
        }}
      >
        All day
      </button>
      <button type="button" className="btn btn-quiet !min-h-9 text-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
