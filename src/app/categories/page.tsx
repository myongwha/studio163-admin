"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import type { Category } from "@/lib/types";
import { PageHeader, Button, TextInput, Card } from "@/components/ui";

// 大>中>小の1段ぶんのカラム
function CategoryColumn({
  title,
  level,
  parentId,
  items,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  placeholder,
  disabledHint,
}: {
  title: string;
  level: number;
  parentId: string | null;
  items: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string, level: number, parentId: string | null) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (c: Category) => void;
  placeholder: string;
  disabledHint?: string;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const disabled = level > 1 && !parentId;

  return (
    <div className="flex-1">
      <p className="mb-2 text-sm font-bold text-black">{title}</p>
      {disabled ? (
        <p className="text-xs text-slate-400">{disabledHint}</p>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onAdd(newName.trim(), level, parentId);
                  setNewName("");
                }
              }}
              placeholder={placeholder}
              className="min-w-0 flex-1"
            />
            <Button
              onClick={() => {
                if (newName.trim()) {
                  onAdd(newName.trim(), level, parentId);
                  setNewName("");
                }
              }}
            >
              ＋
            </Button>
          </div>
          <ul className="flex flex-col gap-1">
            {items.map((c) => {
              const active = c.id === selectedId;
              const editing = c.id === editingId;
              return (
                <li key={c.id}>
                  {editing ? (
                    <div className="flex gap-1">
                      <TextInput
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="min-w-0 flex-1"
                        autoFocus
                      />
                      <Button
                        onClick={() => {
                          if (editName.trim()) onRename(c.id, editName.trim());
                          setEditingId(null);
                        }}
                      >
                        保存
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)}>
                        取消
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-1 border px-2 py-1.5 ${
                        active
                          ? "border-black bg-black text-white"
                          : "border-slate-200 text-black"
                      }`}
                    >
                      <button
                        onClick={() => onSelect(c.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-bold"
                      >
                        {c.name}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                        className={`shrink-0 px-1 text-xs ${
                          active ? "text-white/80" : "text-slate-400"
                        }`}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => onRemove(c)}
                        className={`shrink-0 px-1 text-xs ${
                          active ? "text-white/80" : "text-rose-500"
                        }`}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="text-xs text-slate-400">まだありません。</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { rows, loading, error, save, remove } =
    useTable<Category>("categories");
  const [selLarge, setSelLarge] = useState<string | null>(null);
  const [selMedium, setSelMedium] = useState<string | null>(null);

  const larges = rows.filter((c) => c.level === 1);
  const mediums = rows.filter((c) => c.level === 2 && c.parent_id === selLarge);
  const smalls = rows.filter((c) => c.level === 3 && c.parent_id === selMedium);

  const add = (name: string, level: number, parentId: string | null) =>
    save({ name, level, parent_id: parentId });
  const rename = (id: string, name: string) => save({ id, name });
  const removeCat = (c: Category) => {
    const label =
      c.level === 1 ? "大カテゴリー" : c.level === 2 ? "中カテゴリー" : "小カテゴリー";
    if (
      !confirm(
        `${label}「${c.name}」を削除しますか？（配下の中・小カテゴリーも一緒に削除されます）`,
      )
    )
      return;
    if (c.id === selLarge) {
      setSelLarge(null);
      setSelMedium(null);
    }
    if (c.id === selMedium) setSelMedium(null);
    remove(c.id);
  };

  return (
    <div>
      <PageHeader
        title="カテゴリー"
        subtitle="大 › 中 › 小 の階層で管理。単語の登録時にプルダウンで選べます"
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      {loading ? (
        <p className="text-slate-400">読み込み中…</p>
      ) : (
        <Card>
          <div className="flex flex-col gap-6 md:flex-row md:gap-4">
            <CategoryColumn
              title="大カテゴリー"
              level={1}
              parentId={null}
              items={larges}
              selectedId={selLarge}
              onSelect={(id) => {
                setSelLarge(id);
                setSelMedium(null);
              }}
              onAdd={add}
              onRename={rename}
              onRemove={removeCat}
              placeholder="例: 名詞"
            />
            <CategoryColumn
              title="中カテゴリー"
              level={2}
              parentId={selLarge}
              items={mediums}
              selectedId={selMedium}
              onSelect={(id) => setSelMedium(id)}
              onAdd={add}
              onRename={rename}
              onRemove={removeCat}
              placeholder="例: 食べ物"
              disabledHint="← 先に大カテゴリーを選んでください"
            />
            <CategoryColumn
              title="小カテゴリー"
              level={3}
              parentId={selMedium}
              items={smalls}
              selectedId={null}
              onSelect={() => {}}
              onAdd={add}
              onRename={rename}
              onRemove={removeCat}
              placeholder="例: 果物"
              disabledHint="← 先に中カテゴリーを選んでください"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
