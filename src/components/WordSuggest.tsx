"use client";

import { useState } from "react";
import { TextInput } from "./ui";

type Option = { korean: string; meaning_ja: string };

// 登録済み単語から候補を出す、整ったサジェスト入力（datalist の代替）
export function WordSuggest({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim();
  const matches = (
    q
      ? options.filter(
          (o) => o.korean.includes(q) || o.meaning_ja.includes(q),
        )
      : options
  ).slice(0, 8);

  return (
    <div className="relative">
      <TextInput
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
      />
      {open && matches.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto border border-zinc-300 bg-white">
          {matches.map((o) => (
            <li key={o.korean}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.korean);
                  setOpen(false);
                }}
                className="flex w-full items-baseline gap-2 border-b border-zinc-100 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-zinc-100"
              >
                <span className="font-bold text-zinc-900">{o.korean}</span>
                <span className="truncate text-xs text-zinc-400">
                  {o.meaning_ja}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
