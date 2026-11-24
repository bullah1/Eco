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
      .update({
        display_name: data.displayName,
        phone: data.phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error("We couldn't save your guest details.");
    return { success: true };
  });

export const getMyReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reservations")
      .select(
        "id, booking_reference, check_in, check_out, guest_count, status, nightly_rate_cents, total_cents, guest_note, room_units(name, room_types(name, slug)), reservation_addons(quantity, total_cents, resort_addons(name))",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("We couldn't load your stays.");
    return data ?? [];
  });

export const getGuestDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, role, reservations] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, email, display_name, phone, created_at")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase
        .from("reservations")
        .select(
          "id, booking_reference, check_in, check_out, guest_count, status, nightly_rate_cents, total_cents, guest_note, room_units(name, room_types(name, slug))",
        )
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (profile.error || role.error || reservations.error)
      throw new Error("We couldn't load your account details.");
    return {
      profile: profile.data,
      isAdmin: role.data === true,
      reservations: reservations.data ?? [],
    };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Administrator access is required.");
    const [rooms, units, reservations, guests, gallery, content, addons, reviews, orders, menu] =
      await Promise.all([
        context.supabase.from("room_types").select("*").order("sort_order"),
        context.supabase.from("room_units").select("id, name, is_active, room_type_id"),
        context.supabase
          .from("reservations")
          .select(
            "id, booking_reference, check_in, check_out, guest_count, status, nightly_rate_cents, total_cents, guest_note, guest_name, guest_phone, guest_email, booking_group, room_units(name, room_types(name, slug)), profiles(display_name, email, phone), reservation_addons(quantity, total_cents, resort_addons(name))",
          )
          .order("created_at", { ascending: false }),
        context.supabase
          .from("profiles")
          .select("id, display_name, email, phone, created_at")
          .order("created_at", { ascending: false }),
        context.supabase.from("resort_gallery").select("*").order("sort_order"),
        context.supabase.from("resort_content").select("*").order("content_key"),
        context.supabase.from("resort_addons").select("*").order("sort_order"),
        context.supabase
          .from("guest_reviews")
          .select("*")
          .order("created_at", { ascending: false }),
        context.supabase
          .from("service_orders")
          .select(
            "*, service_order_items(name, quantity, unit_price_cents, line_total_cents), reservations(booking_reference)",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        context.supabase.from("menu_items").select("*").order("sort_order"),
      ]);
    if (
      [
        rooms.error,
        units.error,
        reservations.error,
        guests.error,
        gallery.error,
        content.error,
        addons.error,
        reviews.error,
        orders.error,
        menu.error,
      ].some(Boolean)
    )
      throw new Error("We couldn't load resort management details.");
    return {
      rooms: rooms.data ?? [],
      units: units.data ?? [],
      reservations: reservations.data ?? [],
      guests: guests.data ?? [],
      gallery: gallery.data ?? [],
      content: content.data ?? [],
      addons: addons.data ?? [],
      reviews: reviews.data ?? [],
      orders: orders.data ?? [],
      menu: menu.data ?? [],
    };
  });

export const createRoomType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name: string; slug: string; description: string; rate: number; capacity: number }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase.from("room_types").insert({
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      description: data.description.trim(),
      nightly_rate_cents: Math.round(data.rate * 100),
      max_guests: data.capacity,
    });
    if (error)
      throw new Error(
        error.code === "23505"
          ? "That room address is already in use."
          : "We couldn't save that room type.",
      );
    return { success: true };
  });

export const updateRoomRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; rate: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase
      .from("room_types")
      .update({ nightly_rate_cents: Math.round(data.rate * 100) })
      .eq("id", data.roomId);
    if (error) throw new Error("We couldn't update that rate.");
    return { success: true };
  });

export const setRoomTypeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase
      .from("room_types")
      .update({ is_active: data.isActive })
      .eq("id", data.roomId);
    if (error) throw new Error("We couldn't update that room type.");
    return { success: true };
  });

export const updateReservationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { reservationId: string; status: "pending" | "confirmed" | "cancelled" }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase
      .from("reservations")
      .update({ status: data.status })
      .eq("id", data.reservationId);
    if (error)
      throw new Error(
        error.code === "23P01"
          ? "Those dates now overlap another stay."
          : "We couldn't update that reservation.",
      );
    return { success: true };
  });

export const setRoomUnitActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unitId: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase
      .from("room_units")
      .update({ is_active: data.isActive })
      .eq("id", data.unitId);
    if (error) throw new Error("We couldn't update that room.");
    return { success: true };
  });

export const createRoomUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomTypeId: string; name: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase
      .from("room_units")
      .insert({ room_type_id: data.roomTypeId, name: data.name.trim() });
    if (error)
      throw new Error(
        error.code === "23505"
          ? "That room name is already in use for this stay."
          : "We couldn't add that room.",
      );
    return { success: true };
  });

export const saveGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      imageUrl: string;
      altText: string;
      category: string;
      isPublished: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values = {
      title: data.title.trim(),
      image_url: data.imageUrl.trim(),
      alt_text: data.altText.trim(),
      category: data.category.trim(),
      is_published: data.isPublished,
    };
    const query = data.id
      ? context.supabase.from("resort_gallery").update(values).eq("id", data.id)
      : context.supabase.from("resort_gallery").insert(values);
    const { error } = await query;
    if (error) throw new Error("We couldn't save that gallery item.");
    return { success: true };
  });

export const saveResortContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id?: string; key: string; value: string; isPublished: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values = {
      content_key: data.key.trim(),
      content_value: { copy: data.value },
      is_published: data.isPublished,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? context.supabase.from("resort_content").update(values).eq("id", data.id)
      : context.supabase.from("resort_content").insert(values);
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
    if (!Number.isFinite(input.price) || input.price < 0)
      throw new Error("Enter a price of 0 or more.");
    if (!["food", "service", "activity"].includes(input.category))
      throw new Error("Choose a category.");
    if (!["per_person", "per_person_per_night", "per_night", "per_stay"].includes(input.unit))
      throw new Error("Choose how it is priced.");
    return { ...input, name, description: (input.description ?? "").trim().slice(0, 200) };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
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

type RoomDetailsInput = {
  roomId: string;
  name: string;
  description: string;
  bedType: string;
  sizeSqft: number | null;
  viewLabel: string;
  features: string[];
  imageUrl: string;
  galleryUrls: string[];
  panoramaUrl: string;
  videoUrl: string;
  capacity: number;
};

const cleanUrl = (value: string) => {
  const v = value.trim();
  if (!v) return "";
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new Error(`"${v.slice(0, 60)}" is not a valid web address.`);
  }
};

export const updateRoomDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RoomDetailsInput) => {
    const name = String(input?.name ?? "").trim();
    if (!name || name.length > 80) throw new Error("Give the room a name under 80 characters.");
    const capacity = Math.round(Number(input.capacity));
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 20)
      throw new Error("Guest capacity must be between 1 and 20.");
    const size =
      input.sizeSqft === null || input.sizeSqft === undefined || Number(input.sizeSqft) === 0
        ? null
        : Math.round(Number(input.sizeSqft));
    if (size !== null && (!Number.isFinite(size) || size < 1))
      throw new Error("Room size must be a positive number.");
    return {
      roomId: String(input.roomId),
      name,
      description: String(input.description ?? "")
        .trim()
        .slice(0, 1000),
      bedType: String(input.bedType ?? "")
        .trim()
        .slice(0, 80),
      sizeSqft: size,
      viewLabel: String(input.viewLabel ?? "")
        .trim()
        .slice(0, 60),
      features: (input.features ?? [])
        .map((f) => String(f).trim())
        .filter(Boolean)
        .slice(0, 20),
      imageUrl: cleanUrl(String(input.imageUrl ?? "")),
      galleryUrls: (input.galleryUrls ?? [])
        .map((u) => cleanUrl(String(u)))
        .filter(Boolean)
        .slice(0, 30),
      panoramaUrl: cleanUrl(String(input.panoramaUrl ?? "")),
      videoUrl: cleanUrl(String(input.videoUrl ?? "")),
      capacity,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const { error } = await context.supabase
      .from("room_types")
      .update({
        name: data.name,
        description: data.description,
        bed_type: data.bedType,
        room_size_sqft: data.sizeSqft,
        view_label: data.viewLabel,
        features: data.features,
        image_url: data.imageUrl,
        gallery_urls: data.galleryUrls,
        panorama_url: data.panoramaUrl,
        video_url: data.videoUrl,
        max_guests: data.capacity,
      })
      .eq("id", data.roomId);
    if (error) throw new Error("We couldn't save those room details.");
    return { success: true };
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string; action: "publish" | "hide" | "delete" }) => {
    if (!["publish", "hide", "delete"].includes(input?.action)) throw new Error("Unknown action.");
    return { reviewId: String(input.reviewId), action: input.action };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const query =
      data.action === "delete"
        ? context.supabase.from("guest_reviews").delete().eq("id", data.reviewId)
        : context.supabase
            .from("guest_reviews")
            .update({ is_published: data.action === "publish" })
            .eq("id", data.reviewId);
    const { error } = await query;
    if (error) throw new Error("We couldn't update that review.");
    return { success: true };
  });

const orderStatuses = ["pending", "confirmed", "preparing", "served", "cancelled"] as const;
const billStatuses = ["unbilled", "billed", "paid"] as const;

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status?: string; billStatus?: string }) => {
    const status = input?.status;
    const billStatus = input?.billStatus;
    if (status && !orderStatuses.includes(status as never))
      throw new Error("Unknown order status.");
    if (billStatus && !billStatuses.includes(billStatus as never))
      throw new Error("Unknown bill status.");
    return { orderId: String(input.orderId), status, billStatus };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values: { status?: string; bill_status?: string } = {};
    if (data.status) values.status = data.status;
    if (data.billStatus) values.bill_status = data.billStatus;
    const { error } = await context.supabase
      .from("service_orders")
      .update(values)
      .eq("id", data.orderId);
    if (error) throw new Error("We couldn't update that order.");
    return { success: true };
  });

type MenuItemInput = {
  id?: string;
  category: "food" | "drinks" | "service" | "activity";
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
};

export const saveMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MenuItemInput) => {
    const name = String(input?.name ?? "").trim();
    if (!name || name.length > 80) throw new Error("Give the item a name under 80 characters.");
    if (!["food", "drinks", "service", "activity"].includes(input.category))
      throw new Error("Choose a category.");
    if (!Number.isFinite(input.price) || input.price < 0)
      throw new Error("Enter a price of 0 or more.");
    return {
      ...input,
      name,
      description: String(input.description ?? "")
        .trim()
        .slice(0, 300),
      imageUrl: cleanUrl(String(input.imageUrl ?? "")),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Administrator access is required.");
    const values = {
      category: data.category,
      name: data.name,
      description: data.description,
      price_cents: Math.round(data.price * 100),
      image_url: data.imageUrl,
      is_available: data.isAvailable,
    };
    const query = data.id
      ? context.supabase.from("menu_items").update(values).eq("id", data.id)
      : context.supabase.from("menu_items").insert(values);
    const { error } = await query;
    if (error) throw new Error("We couldn't save that menu item.");
    return { success: true };
  });
