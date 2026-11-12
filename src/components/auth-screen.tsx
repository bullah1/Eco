import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import heroImage from "@/assets/sagara-coast-hero.jpg";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth-context";

export function AuthScreen() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const user = useCurrentUser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const target = window.sessionStorage.getItem("sagara-auth-next");
    if (!target) return;
    window.sessionStorage.removeItem("sagara-auth-next");
    if (target.startsWith("/booking")) {
      const targetUrl = new URL(target, window.location.origin);
        const checkIn = targetUrl.searchParams.get("checkIn") ?? undefined;
        const checkOut = targetUrl.searchParams.get("checkOut") ?? undefined;
        const guests = Number(targetUrl.searchParams.get("guests")) || undefined;
        void navigate({ to: "/booking", search: {
          ...(checkIn ? { checkIn } : {}),
          ...(checkOut ? { checkOut } : {}),
          ...(guests ? { guests } : {}),
        } });
    } else if (target === "/admin") {
      void navigate({ to: "/admin" });
    } else if (target === "/account") {
      void navigate({ to: "/account" });
    } else {
      void navigate({ to: "/my-stays" });
    }
  }, [navigate, user]);

  async function completeSignIn() {
    const next = search.next ?? "/my-stays";
    if (next === "/booking") {
      await navigate({ to: "/booking", search: {
        ...(search.checkIn ? { checkIn: search.checkIn } : {}),
        ...(search.checkOut ? { checkOut: search.checkOut } : {}),
        ...(search.guests ? { guests: search.guests } : {}),
      } });
    } else if (next === "/admin") {
      await navigate({ to: "/admin" });
    } else if (next === "/account") {
      await navigate({ to: "/account" });
    } else {
      await navigate({ to: "/my-stays" });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (mode === "signup") {
        const next = search.next ?? "/my-stays";
        const signupReturn = new URLSearchParams({ next });
        if (next === "/booking") {
          if (search.checkIn) signupReturn.set("checkIn", search.checkIn);
          if (search.checkOut) signupReturn.set("checkOut", search.checkOut);
          if (search.guests) signupReturn.set("guests", String(search.guests));
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?${signupReturn.toString()}`,
            data: { display_name: name.trim() },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) await completeSignIn();
        else setNotice("Your account is ready. Check your email to confirm your address, then sign in.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await completeSignIn();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider: "google" | "lovable") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = search.next ?? "/my-stays";
      const target = next === "/booking"
        ? `/booking?${new URLSearchParams({ ...(search.checkIn ? { checkIn: search.checkIn } : {}), ...(search.checkOut ? { checkOut: search.checkOut } : {}), ...(search.guests ? { guests: String(search.guests) } : {}) }).toString()}`
        : next;
      window.sessionStorage.setItem("sagara-auth-next", target);
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await completeSignIn();
      window.sessionStorage.removeItem("sagara-auth-next");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100svh-68px)] lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden min-h-[760px] overflow-hidden bg-resort-wood lg:block">
        <img src={heroImage} alt="" width={1600} height={960} className="absolute inset-0 size-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-primary/45" />
        <div className="relative flex h-full min-h-[760px] flex-col justify-between p-12 text-resort-cream xl:p-20">
          <BrandLogo tone="dark" />
          <div className="max-w-xl">
            <p className="sagara-eyebrow text-[10px] font-semibold uppercase text-resort-gold">A quieter kind of coast</p>
            <h1 className="mt-5 text-5xl leading-tight xl:text-6xl">Come back to your own rhythm.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-resort-cream/75">Keep your stay close at hand, from the first morning light to the day you return home.</p>
          </div>
          <p className="text-xs text-resort-cream/65">Where Silence Meets the Sea · Santa Monica, California</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-[430px]">
          <Button variant="ghost" size="sm" asChild className="mb-10 -ml-3"><Link to="/"><ArrowLeft size={15} /> Back to home</Link></Button>
          <p className="sagara-eyebrow text-[10px] font-semibold uppercase text-resort-ocean">{mode === "signin" ? "Welcome back" : "Your coast, closer"}</p>
          <h2 className="mt-3 text-4xl text-primary">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{mode === "signin" ? "Your next quiet moment is waiting." : "Save your details and keep your stays together."}</p>

          <div className="mt-8 grid gap-3">
            <Button type="button" variant="outline" className="sagara-provider-google h-11 justify-center gap-3 rounded-sm" disabled={busy} onClick={() => socialSignIn("google")}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
              Continue with Google
            </Button>
            <Button type="button" variant="outline" className="h-11 justify-center rounded-sm" disabled={busy} onClick={() => socialSignIn("lovable")}>Continue with Lovable</Button>
          </div>

          <div className="my-7 flex items-center gap-4"><span className="h-px flex-1 bg-border"/><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">or use email</span><span className="h-px flex-1 bg-border"/></div>
          <form onSubmit={submit} className="grid gap-5">
            {mode === "signup" && <div className="grid gap-2"><Label htmlFor="display-name">Full name</Label><Input id="display-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></div>}
            <div className="grid gap-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div className="grid gap-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required className="pr-11"/><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</Button></div></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="border border-resort-ocean/25 bg-resort-ocean-soft p-3 text-sm leading-6 text-resort-ocean">{notice}</p>}
            <Button type="submit" disabled={busy} className="h-11 rounded-sm">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}<ArrowRight size={15}/></Button>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">{mode === "signin" ? "New here?" : "Already have an account?"}{" "}<button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => {setMode(mode === "signin" ? "signup" : "signin"); setNotice(""); setError("");}}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p>
          <p className="mt-8 text-center text-[11px] leading-5 text-muted-foreground">Your account details are used to manage your stays and guest preferences.</p>
        </div>
      </section>
    </div>
  );
}