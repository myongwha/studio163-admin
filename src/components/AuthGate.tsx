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
      <div className="grid min-h-dvh place-items-center text-zinc-400">
        読み込み中…
      </div>
    );
  if (!session) return <LoginForm />;

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, signOut }}>
      <div className="flex h-dvh overflow-hidden bg-zinc-100">
        <Sidebar onSignOut={signOut} email={session.user.email ?? ""} />
        <main className="flex-1 overflow-y-auto p-10">
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
    <div className="grid min-h-dvh place-items-center bg-zinc-100 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-zinc-200 bg-white p-10"
      >
        <p className="flex items-baseline gap-0.5 text-2xl font-semibold tracking-tight">
          <span className="text-zinc-900">studio</span>
          <span className="text-zinc-300">163</span>
        </p>
        <p className="mt-1 text-sm text-zinc-500">管理画面にログイン</p>

        <label className="mt-8 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          メールアドレス
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1.5 w-full border border-zinc-300 px-3 py-2 text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          パスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1.5 w-full border border-zinc-300 px-3 py-2 text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none"
        />

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-7 w-full border border-zinc-900 bg-zinc-900 py-2.5 font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
        <p className="mt-4 text-xs text-zinc-400">
          管理者ユーザーは Supabase の Authentication で作成してください。
        </p>
      </form>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-100 p-6">
      <div className="max-w-md border border-zinc-200 bg-white p-10">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          Supabase が未設定です
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          <code>.env.local</code> に下記を設定して再起動してください。
        </p>
        <pre className="mt-4 overflow-x-auto border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-100">
          {`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
        </pre>
      </div>
    </div>
  );
}
