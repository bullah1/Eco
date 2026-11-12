import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LoaderCircle, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/resort-site";
import { useCurrentUser } from "@/lib/auth-context";
import { getGuestProfile, updateGuestProfile } from "@/lib/resort.functions";

export function AccountPage() {
  const user = useCurrentUser();
  const updateProfile = useServerFn(updateGuestProfile);
  const { data: profile, isLoading, isError, refetch } = useQuery({ queryKey: ["guest-profile", user?.id], queryFn: () => getGuestProfile(), enabled: Boolean(user) });
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setSaving(true);
    try {
      await updateProfile({ data: { displayName: name ?? profile?.display_name ?? "", phone: phone ?? profile?.phone ?? "" } });
      await refetch();
      setNotice("Your guest details are saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't save your details.");
    } finally { setSaving(false); }
  }

  return <div className="min-h-[calc(100svh-68px)] bg-resort-cream px-5 py-12 sm:px-8 lg:py-16"><div className="mx-auto max-w-5xl"><Eyebrow>Your guest account</Eyebrow><h1 className="mt-3 text-4xl text-primary sm:text-5xl">Guest details.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">The details we keep to make your next visit feel a little more like yours.</p>
    {!user && <div className="mt-10 border-y border-border bg-background p-6 sm:p-8"><UserRound size={24} className="text-resort-ocean"/><h2 className="mt-4 font-display text-3xl text-primary">Your details, your stays.</h2><p className="mt-3 text-sm text-muted-foreground">Sign in to view and update your guest profile.</p><Button className="mt-6" asChild><Link to="/auth" search={{next:"/account"}}>Sign in <ArrowRight size={15}/></Link></Button></div>}
    {user && <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_0.7fr]"><section className="border-y border-border bg-background p-6 sm:p-8"><h2 className="font-display text-2xl text-primary">Profile information</h2>{isLoading&&<p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin"/>Loading your details…</p>}{isError&&<p role="alert" className="mt-5 text-sm text-destructive">Your guest profile couldn't be loaded. Please try again.</p>}{profile&&<form className="mt-6 grid gap-5" onSubmit={save}><div className="grid gap-2"><Label htmlFor="account-email">Email address</Label><Input id="account-email" type="email" value={profile.email||user.email||""} readOnly className="bg-muted"/><p className="text-[11px] text-muted-foreground">Email changes are managed through your sign-in provider.</p></div><div className="grid gap-2"><Label htmlFor="account-name">Full name</Label><Input id="account-name" autoComplete="name" value={name??profile.display_name} onChange={event=>setName(event.target.value)} required/></div><div className="grid gap-2"><Label htmlFor="account-phone">Phone number</Label><Input id="account-phone" type="tel" autoComplete="tel" value={phone??profile.phone} onChange={event=>setPhone(event.target.value)} required/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-resort-ocean">{notice}</p>}<Button type="submit" disabled={saving}>{saving?"Saving…":"Save guest details"}</Button></form>}</section><aside className="h-fit border-t border-resort-gold pt-6"><Eyebrow>When you’re ready</Eyebrow><h2 className="mt-4 font-display text-2xl text-primary">A little more room to breathe.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your reservation requests and upcoming stays live in one quiet place.</p><Button variant="outline" className="mt-6" asChild><Link to="/my-stays">View my stays <ArrowRight size={15}/></Link></Button><p className="mt-8 text-xs leading-5 text-muted-foreground">Your profile is visible only to you and authorized resort administrators.</p></aside></div>}
  </div></div>;
}