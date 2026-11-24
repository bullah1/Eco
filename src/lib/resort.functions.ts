import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGuestProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, phone, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("We couldn't load your guest profile.");
    return data;
  });

export const updateGuestProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string; phone: string }) => {
    const displayName = typeof input?.displayName === "string" ? input.displayName.trim() : "";
    const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
    if (displayName.length > 100 || phone.length > 30) {
      throw new Error("Please keep your name under 100 characters and your phone number under 30.");
    }
    return { displayName, phone };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.displayName, phone: data.phone, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error("We couldn't save your guest details.");
    return { success: true };
  });

export const getMyReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reservations")
      .select("id, booking_reference, check_in, check_out, guest_count, status, nightly_rate_cents, total_cents, guest_note, room_units(name, room_types(name, slug)), reservation_addons(quantity, total_cents, resort_addons(name))")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("We couldn't load your stays.");
    return data ?? [];
  });

export const getGuestDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, role, reservations] = await Promise.all([
      context.supabase.from("profiles").select("id, email, display_name, phone, created_at").eq("id", context.userId).maybeSingle(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.from("reservations").select("id, booking_reference, check_in, check_out, guest_count, status, nightly_rate_cents, total_cents, guest_note, room_units(name, room_types(name, slug))").eq("user_id", context.userId).order("created_at", { ascending: false }),
    ]);
    if (profile.error || role.error || reservations.error) throw new Error("We couldn't load your account details.");
    return { profile: profile.data, isAdmin: role.data === true, reservations: reservations.data ?? [] };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !isAdmin) throw new Error("Administrator access is required.");
    const [rooms, units, reservations, guests, gallery, content, addons] = await Promise.all([
      context.supabase.from("room_types").select("*").order("sort_order"),
      context.supabase.from("room_units").select("id, name, is_active, room_type_id"),
      context.supabase.from("reservations").select("id, booking_reference, check_in, check_out, guest_count, status, nightly_rate_cents, total_cents, guest_note, room_units(name, room_types(name, slug)), profiles(display_name, email, phone), reservation_addons(quantity, total_cents, resort_addons(name))").order("created_at", { ascending: false }),
      context.supabase.from("profiles").select("id, display_name, email, phone, created_at").order("created_at", { ascending: false }),
      context.supabase.from("resort_gallery").select("*").order("sort_order"),
      context.supabase.from("resort_content").select("*").order("content_key"),
      context.supabase.from("resort_addons").select("*").order("sort_order"),
    ]);
    if ([rooms.error, units.error, reservations.error, guests.error, gallery.error, content.error, addons.error].some(Boolean)) throw new Error("We couldn't load resort management details.");
    return { rooms: rooms.data ?? [], units: units.data ?? [], reservations: reservations.data ?? [], guests: guests.data ?? [], gallery: gallery.data ?? [], content: content.data ?? [], addons: addons.data ?? [] };
  });

export const createRoomType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; slug: string; description: string; rate: number; capacity: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("room_types").insert({ name: data.name.trim(), slug: data.slug.trim().toLowerCase(), description: data.description.trim(), nightly_rate_cents: Math.round(data.rate * 100), max_guests: data.capacity });
    if (error) throw new Error(error.code === "23505" ? "That room address is already in use." : "We couldn't save that room type.");
    return { success: true };
  });

export const updateRoomRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; rate: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("room_types").update({ nightly_rate_cents: Math.round(data.rate * 100) }).eq("id", data.roomId);
    if (error) throw new Error("We couldn't update that rate.");
    return { success: true };
  });

export const setRoomTypeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("room_types").update({ is_active: data.isActive }).eq("id", data.roomId);
    if (error) throw new Error("We couldn't update that room type.");
    return { success: true };
  });

export const updateReservationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reservationId: string; status: "pending" | "confirmed" | "cancelled" }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("reservations").update({ status: data.status }).eq("id", data.reservationId);
    if (error) throw new Error(error.code === "23P01" ? "Those dates now overlap another stay." : "We couldn't update that reservation.");
    return { success: true };
  });

export const setRoomUnitActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unitId: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("room_units").update({ is_active: data.isActive }).eq("id", data.unitId);
    if (error) throw new Error("We couldn't update that room.");
    return { success: true };
  });

export const createRoomUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomTypeId: string; name: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("room_units").insert({ room_type_id: data.roomTypeId, name: data.name.trim() });
    if (error) throw new Error(error.code === "23505" ? "That room name is already in use for this stay." : "We couldn't add that room.");
    return { success: true };
  });

export const saveGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; title: string; imageUrl: string; altText: string; category: string; isPublished: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values = { title: data.title.trim(), image_url: data.imageUrl.trim(), alt_text: data.altText.trim(), category: data.category.trim(), is_published: data.isPublished };
    const query = data.id ? context.supabase.from("resort_gallery").update(values).eq("id", data.id) : context.supabase.from("resort_gallery").insert(values);
    const { error } = await query;
    if (error) throw new Error("We couldn't save that gallery item.");
    return { success: true };
  });

export const saveResortContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; key: string; value: string; isPublished: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values = { content_key: data.key.trim(), content_value: { copy: data.value }, is_published: data.isPublished, updated_at: new Date().toISOString() };
    const query = data.id ? context.supabase.from("resort_content").update(values).eq("id", data.id) : context.supabase.from("resort_content").insert(values);
    const { error } = await query;
    if (error) throw new Error("We couldn't save that resort content.");
    return { success: true };
  });
type AddonInput = {
  id?: string;
  category: "food" | "service" | "activity";
  name: string;
  description: string;
  price: number;
  unit: "per_person" | "per_person_per_night" | "per_night" | "per_stay";
  isActive: boolean;
};

export const saveAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AddonInput) => {
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 80) throw new Error("Give the item a name under 80 characters.");
    if (!Number.isFinite(input.price) || input.price < 0) throw new Error("Enter a price of 0 or more.");
    if (!["food", "service", "activity"].includes(input.category)) throw new Error("Choose a category.");
    if (!["per_person", "per_person_per_night", "per_night", "per_stay"].includes(input.unit)) throw new Error("Choose how it is priced.");
    return { ...input, name, description: (input.description ?? "").trim().slice(0, 200) };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values = {
      category: data.category,
      name: data.name,
      description: data.description,
      price_cents: Math.round(data.price * 100),
      unit: data.unit,
      is_active: data.isActive,
    };
    const query = data.id
      ? context.supabase.from("resort_addons").update(values).eq("id", data.id)
      : context.supabase.from("resort_addons").insert(values);
    const { error } = await query;
    if (error) throw new Error("We couldn't save that item.");
    return { success: true };
  });
