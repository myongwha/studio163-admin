"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { Sidebar } from "./Sidebar";

interface AuthCtx {
  session: Session;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthGate");
  return c;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <ConfigNotice />;
  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center text-slate-400">
        読み込み中…
      </div>
    );
  if (!session) return <LoginForm />;

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, signOut }}>
      <div className="flex min-h-dvh">
        <Sidebar onSignOut={signOut} email={session.user.email ?? ""} />
        <main className="flex-1 overflow-x-clip bg-zinc-50 p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </Ctx.Provider>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await getSupabase()!.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border-2 border-black bg-white p-8"
      >
        <p className="flex items-baseline text-2xl font-bold tracking-tight">
          <span className="text-black">studio</span>
          <span className="text-black/30">163</span>
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-500">
          管理画面にログイン
        </p>

        <label className="mt-7 block text-sm font-bold text-black">
          メールアドレス
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1.5 w-full border-2 border-black px-3 py-2 focus:outline-none"
        />

        <label className="mt-4 block text-sm font-bold text-black">
          パスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1.5 w-full border-2 border-black px-3 py-2 focus:outline-none"
        />

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full border-2 border-black bg-black py-2.5 font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-40"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
        <p className="mt-4 text-xs font-medium text-zinc-400">
          管理者ユーザーは Supabase の Authentication で作成してください。
        </p>
      </form>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-lg font-black text-slate-800">
          Supabase が未設定です
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          <code>.env.local</code> に下記を設定して再起動してください。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
          {`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
        </pre>
      </div>
    </div>
  );
}
