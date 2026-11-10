#!/usr/bin/env python3
"""Sinh supabase/seed.sql từ data/seed.json.

Chạy:  python3 scripts/gen_seed_sql.py
Seed dùng ON CONFLICT DO UPDATE nên chạy lại nhiều lần vẫn an toàn.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))


def lit(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def upsert(table, cols, rows, key="id"):
    out = [f"insert into public.{table} ({', '.join(cols)}) values"]
    out.append(",\n".join("  (" + ", ".join(lit(r.get(c)) for c in cols) + ")" for r in rows))
    upd = ", ".join(f"{c} = excluded.{c}" for c in cols if c != key)
    out.append(f"on conflict ({key}) do update set {upd};\n")
    return "\n".join(out)


term_cols = ["id", "subject_id", "topic_id", "grade", "term_en", "term_vi", "ipa", "pos",
             "def_en", "def_vi", "example_en", "example_vi", "note", "related", "status"]
for t in data["terms"]:
    t.setdefault("status", "published")

sql = [
    "-- SubjectDict seed data (sinh tự động từ data/seed.json — đừng sửa tay)",
    f"-- {len(data['subjects'])} môn, {len(data['topics'])} chủ đề, {len(data['terms'])} thuật ngữ\n",
    "begin;\n",
    upsert("subjects", ["id", "name_vi", "name_en", "color", "sort"], data["subjects"]),
    upsert("topics", ["id", "subject_id", "name_vi", "name_en", "sort"], data["topics"]),
    upsert("terms", term_cols, data["terms"]),
    "commit;\n",
]
dest = ROOT / "supabase" / "seed.sql"
dest.write_text("\n".join(sql), encoding="utf-8")
print(f"Wrote {dest.relative_to(ROOT)}: {len(data['terms'])} terms")
