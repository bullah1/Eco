import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BedDouble,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  FileImage,
  LoaderCircle,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/room-booking";
import { categoryLabel, unitLabel, type AddonCategory, type AddonUnit } from "@/lib/addons";
import {
  moderateReview,
  saveMenuItem,
  updateOrder,
  saveAddon,
  updateRoomDetails,
  getAdminOverview,
  createRoomType,
  updateRoomRate,
  setRoomTypeActive,
  updateReservationStatus,
  setRoomUnitActive,
  createRoomUnit,
  saveGalleryItem,
  saveResortContent,
} from "@/lib/resort.functions";
import { useCurrentUser } from "@/lib/auth-context";
import { Eyebrow } from "@/components/resort-site";

type AdminPanelKey =
  | "rooms"
  | "bookings"
  | "guests"
  | "gallery"
  | "content"
  | "addons"
  | "reviews"
  | "orders"
  | "menu";

export function AdminPage() {
  const user = useCurrentUser();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-overview", user?.id],
    queryFn: () => getAdminOverview(),
    enabled: Boolean(user),
    refetchInterval: 30_000,
    retry: false,
  });
  return (
    <div className="min-h-[calc(100svh-68px)] bg-resort-cream px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Eyebrow>Resort management</Eyebrow>
            <h1 className="mt-3 text-4xl text-primary sm:text-5xl">The house ledger</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              A clear view of the stays and details that keep the resort moving.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-resort-ocean">
            <ShieldCheck size={16} />
            Private management
          </div>
        </div>
        {isLoading && (
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle size={16} className="animate-spin" />
            Opening the management desk…
          </p>
        )}
        {isError && (
          <div className="mt-10 border border-resort-gold bg-background p-6">
            <CircleAlert size={22} className="text-resort-ocean" />
            <h2 className="mt-4 font-display text-2xl text-primary">
              Management access is restricted
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {user
                ? error.message.includes("Administrator")
                  ? "Your signed-in account does not have an administrator role."
                  : "The resort management view could not be loaded."
                : "Sign in with an administrator account to manage resort information."}
            </p>
            {!user && (
              <Button className="mt-5" asChild>
                <Link to="/auth" search={{ next: "/admin" }}>
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        )}
        {data && (
          <div className="mt-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Stay types", data.rooms.length, BedDouble],
                ["Rooms", data.units.length, Activity],
                ["Reservation requests", data.reservations.length, BookOpen],
                ["Guest accounts", data.guests.length, Users],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof BedDouble;
                return (
                  <div key={String(label)} className="border-y border-border bg-background p-5">
                    <div className="flex items-center justify-between">
                      <Eyebrow>{String(label)}</Eyebrow>
                      <MetricIcon size={17} className="text-resort-ocean" />
                    </div>
                    <p className="mt-4 font-display text-4xl text-primary">{String(value)}</p>
                  </div>
                );
              })}
            </div>
            <Tabs defaultValue="rooms" className="mt-10">
              <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-none bg-transparent p-0">
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="rooms"
                >
                  <BedDouble size={15} /> Rooms & rates
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="bookings"
                >
                  <BookOpen size={15} /> Reservations
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="orders"
                >
                  <ReceiptText size={15} /> Orders
                  {data.orders.some((o: any) => o.status === "pending") &&
                    ` (${data.orders.filter((o: any) => o.status === "pending").length} new)`}
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="menu"
                >
                  <ShoppingBag size={15} /> Menu
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="guests"
                >
                  <Users size={15} /> Guests
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="gallery"
                >
                  <FileImage size={15} /> Gallery
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="addons"
                >
                  <UtensilsCrossed size={15} /> Meals & extras
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="reviews"
                >
                  <Star size={15} /> Reviews
                  {data.reviews.some((r: any) => !r.is_published) &&
                    ` (${data.reviews.filter((r: any) => !r.is_published).length} new)`}
                </TabsTrigger>
                <TabsTrigger
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-resort-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  value="content"
                >
                  <ChevronRight size={15} /> Content
                </TabsTrigger>
              </TabsList>
              <TabsContent value="rooms" className="mt-0">
                <RoomsAdmin rooms={data.rooms} units={data.units} panelKey="rooms" />
              </TabsContent>
              <TabsContent value="bookings" className="mt-0">
                <BookingsAdmin reservations={data.reservations} panelKey="bookings" />
              </TabsContent>
              <TabsContent value="guests" className="mt-0">
                <GuestsAdmin guests={data.guests} />
              </TabsContent>
              <TabsContent value="orders" className="mt-0">
                <OrdersAdmin orders={data.orders} panelKey="orders" />
              </TabsContent>
              <TabsContent value="menu" className="mt-0">
                <MenuAdmin items={data.menu} panelKey="menu" />
              </TabsContent>
              <TabsContent value="reviews" className="mt-0">
                <ReviewsAdmin items={data.reviews} panelKey="reviews" />
              </TabsContent>
              <TabsContent value="addons" className="mt-0">
                <AddonsAdmin items={data.addons} panelKey="addons" />
              </TabsContent>
              <TabsContent value="gallery" className="mt-0">
                <GalleryAdmin items={data.gallery} panelKey="gallery" />
              </TabsContent>
              <TabsContent value="content" className="mt-0">
                <ContentAdmin items={data.content} panelKey="content" />
              </TabsContent>
            </Tabs>
            <p className="mt-6 border-l-2 border-resort-gold pl-3 text-xs leading-5 text-muted-foreground">
              Only accounts granted the administrator role can edit resort inventory, reservations,
              gallery, and content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function useAdminMutation<TData>(
  panelKey: AdminPanelKey,
  mutationFn: (data: TData) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn,
    onSuccess: async () => {
      setNotice("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "We couldn't save this change."),
  });
  void panelKey;
  return { mutation, notice, setNotice };
}

function RoomsAdmin({
  rooms,
  units,
  panelKey,
}: {
  rooms: any[];
  units: any[];
  panelKey: AdminPanelKey;
}) {
  const { mutation: addRoom, notice: addNotice } = useAdminMutation(
    panelKey,
    (data: { name: string; slug: string; description: string; rate: number; capacity: number }) =>
      createRoomType({ data }),
  );
  const { mutation: addUnit, notice: unitNotice } = useAdminMutation(
    panelKey,
    (data: { roomTypeId: string; name: string }) => createRoomUnit({ data }),
  );
  const { mutation: updateRate } = useAdminMutation(
    panelKey,
    (data: { roomId: string; rate: number }) => updateRoomRate({ data }),
  );
  const { mutation: toggleActive } = useAdminMutation(
    panelKey,
    (data: { roomId: string; isActive: boolean }) => setRoomTypeActive({ data }),
  );
  const { mutation: toggleUnit } = useAdminMutation(
    panelKey,
    (data: { unitId: string; isActive: boolean }) => setRoomUnitActive({ data }),
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [unitName, setUnitName] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  async function submitType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await addRoom.mutateAsync({
      name,
      slug,
      description,
      rate: Number(rate),
      capacity: Number(capacity),
    });
    if (!addRoom.isError) {
      setName("");
      setSlug("");
      setDescription("");
      setRate("");
    }
  }
  async function submitUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomTypeId) return;
    await addUnit.mutateAsync({ roomTypeId, name: unitName });
    if (!addUnit.isError) setUnitName("");
  }
  return (
    <section className="border-y border-border bg-background p-5 sm:p-7">
      <div>
        <Eyebrow>Accommodation inventory</Eyebrow>
        <h2 className="mt-3 font-display text-3xl text-primary">Rooms & rates</h2>
      </div>
      {rooms.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          There are no room types yet. Add the resort’s confirmed names, guest capacity, and nightly
          rate to begin accepting reservation requests.
        </p>
      ) : (
        <div className="mt-6 grid gap-5">
          {rooms.map((room) => (
            <RoomTypeRow
              key={room.id}
              room={room}
              units={units.filter((unit) => unit.room_type_id === room.id)}
              onRate={(rate) => updateRate.mutate({ roomId: room.id, rate })}
              onActive={(isActive) => toggleActive.mutate({ roomId: room.id, isActive })}
              onUnit={(unitId, isActive) => toggleUnit.mutate({ unitId, isActive })}
            />
          ))}
        </div>
      )}
      <div className="mt-8 grid gap-8 border-t border-border pt-7 lg:grid-cols-2">
        <form className="grid gap-4" onSubmit={submitType}>
          <h3 className="font-display text-2xl text-primary">Add a stay type</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="type-name">Stay name</Label>
              <Input
                id="type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type-slug">Short address</Label>
              <Input
                id="type-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type-description">Description</Label>
            <Textarea
              id="type-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="type-rate">Nightly rate (৳)</Label>
              <Input
                id="type-rate"
                type="number"
                min="0.01"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type-capacity">Guest capacity</Label>
              <Input
                id="type-capacity"
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={addRoom.isPending}>
            <Plus size={15} />
            Add stay type
          </Button>
          {addNotice && (
            <p role="status" className="text-xs text-muted-foreground">
              {addNotice}
            </p>
          )}
        </form>
        <form className="grid content-start gap-4" onSubmit={submitUnit}>
          <h3 className="font-display text-2xl text-primary">Add a room</h3>
          <div className="grid gap-2">
            <Label htmlFor="unit-type">Stay type</Label>
            <Select value={roomTypeId} onValueChange={setRoomTypeId}>
              <SelectTrigger id="unit-type">
                <SelectValue placeholder="Choose a stay type" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit-name">Room name</Label>
            <Input
              id="unit-name"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={addUnit.isPending || !roomTypeId}>
            <Plus size={15} />
            Add room
          </Button>
          {unitNotice && (
            <p role="status" className="text-xs text-muted-foreground">
              {unitNotice}
            </p>
          )}
        </form>
      </div>
      <p className="mt-8 border-l-2 border-resort-gold pl-3 text-xs leading-5 text-muted-foreground">
        Room types and rates must be supplied and confirmed by the resort. Reservation requests use
        these rates when first submitted.
      </p>
    </section>
  );
}

function RoomTypeRow({
  room,
  units,
  onRate,
  onActive,
  onUnit,
}: {
  room: any;
  units: any[];
  onRate: (rate: number) => void;
  onActive: (active: boolean) => void;
  onUnit: (id: string, active: boolean) => void;
}) {
  const [nextRate, setNextRate] = useState((room.nightly_rate_cents / 100).toFixed(2));
  return (
    <article className="border-t border-border pt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl text-primary">{room.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {room.max_guests} guests · {room.is_active ? "Taking requests" : "Not listed"}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {room.description}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          Listed{" "}
          <Switch
            checked={room.is_active}
            onCheckedChange={onActive}
            aria-label={`List ${room.name}`}
          />
        </label>
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onRate(Number(nextRate));
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor={`rate-${room.id}`}>Nightly rate (৳)</Label>
          <Input
            id={`rate-${room.id}`}
            type="number"
            min="0.01"
            step="0.01"
            className="w-36"
            value={nextRate}
            onChange={(e) => setNextRate(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" type="submit">
          Update rate
        </Button>
        <span className="text-xs text-muted-foreground">
          {units.length} room{units.length === 1 ? "" : "s"}
        </span>
      </form>
      {units.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {units.map((unit) => (
            <label key={unit.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {unit.name}
              <Switch
                checked={unit.is_active}
                onCheckedChange={(checked) => onUnit(unit.id, checked)}
                aria-label={`List room ${unit.name}`}
              />
            </label>
          ))}
        </div>
      )}
      <RoomDetailsEditor room={room} />
    </article>
  );
}

function BookingsAdmin({
  reservations,
  panelKey,
}: {
  reservations: any[];
  panelKey: AdminPanelKey;
}) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: { reservationId: string; status: "pending" | "confirmed" | "cancelled" }) =>
      updateReservationStatus({ data }),
  );
  return (
    <section className="border-y border-border bg-background p-5 sm:p-7">
      <Eyebrow>Guest requests</Eyebrow>
      <h2 className="mt-3 font-display text-3xl text-primary">Reservations</h2>
      {reservations.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Reservation requests appear here once guests submit their dates.
        </p>
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((item) => {
                const room = item.room_units as {
                  name: string;
                  room_types: { name: string };
                } | null;
                const profile = item.profiles as {
                  display_name: string;
                  email: string;
                  phone?: string;
                } | null;
                const guest = {
                  display_name: profile?.display_name || item.guest_name,
                  email: [item.guest_phone || profile?.phone, item.guest_email || profile?.email]
                    .filter(Boolean)
                    .join(" · "),
                };
                return (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-40">
                      <span className="block font-medium text-primary">
                        {guest?.display_name || "Guest"}
                      </span>
                      <span className="text-xs text-muted-foreground">{guest?.email}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block">{room?.room_types?.name || "Stay"}</span>
                      <span className="text-xs text-muted-foreground">
                        {room?.name || ""} · Ref {item.booking_reference}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-32 text-xs">
                      {item.check_in}
                      <br />
                      to {item.check_out}
                    </TableCell>
                    <TableCell className="min-w-40">
                      <span className="block tabular-nums">
                        {formatMoney(
                          item.total_cents +
                            ((item.reservation_addons ?? []) as { total_cents: number }[]).reduce(
                              (a, e) => a + e.total_cents,
                              0,
                            ),
                        )}
                      </span>
                      {(
                        (item.reservation_addons ?? []) as {
                          quantity: number;
                          resort_addons: { name: string } | null;
                        }[]
                      ).map((e, i) => (
                        <span key={i} className="block text-xs text-muted-foreground">
                          {e.resort_addons?.name} × {e.quantity}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-2">
                        <span className="text-xs capitalize text-muted-foreground">
                          {item.status}
                        </span>
                        <Select
                          value={item.status}
                          onValueChange={(status: "pending" | "confirmed" | "cancelled") =>
                            mutation.mutate({ reservationId: item.id, status })
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirm</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}

function GuestsAdmin({ guests }: { guests: any[] }) {
  const searchQuery = useState("");
  const [search, setSearch] = searchQuery;
  const filtered = useMemo(
    () =>
      guests.filter((guest) =>
        `${guest.display_name} ${guest.email} ${guest.phone}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [guests, search],
  );
  return (
    <section className="border-y border-border bg-background p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Guest book</Eyebrow>
          <h2 className="mt-3 font-display text-3xl text-primary">Guest accounts</h2>
        </div>
        <Input
          aria-label="Search guests"
          placeholder="Find a guest"
          className="w-full sm:max-w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {guests.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Guest profiles will appear as accounts are created.
        </p>
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">{guest.display_name || "Guest"}</TableCell>
                  <TableCell>{guest.email}</TableCell>
                  <TableCell>{guest.phone || "—"}</TableCell>
                  <TableCell>{new Date(guest.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">No guests match that search.</p>
          )}
        </div>
      )}
    </section>
  );
}

function GalleryAdmin({ items, panelKey }: { items: any[]; panelKey: AdminPanelKey }) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: {
      title: string;
      imageUrl: string;
      altText: string;
      category: string;
      isPublished: boolean;
    }) => saveGalleryItem({ data }),
  );
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [category, setCategory] = useState("resort");
  const [isPublished, setIsPublished] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({ title, imageUrl, altText, category, isPublished });
    if (!mutation.isError) {
      setTitle("");
      setImageUrl("");
      setAltText("");
    }
  }
  return (
    <section className="grid gap-8 border-y border-border bg-background p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <Eyebrow>Visual story</Eyebrow>
        <h2 className="mt-3 font-display text-3xl text-primary">Gallery</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Add approved image URLs and descriptions. Only published images are visible on public
            pages.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="border-y border-border py-3">
                <div className="aspect-[4/3] bg-muted">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.alt_text}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <h3 className="mt-2 text-sm font-medium text-primary">{item.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {item.is_published ? "Published" : "Draft"} · {item.category}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
      <form
        onSubmit={submit}
        className="grid content-start gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"
      >
        <h3 className="font-display text-2xl text-primary">Add a gallery image</h3>
        <div className="grid gap-2">
          <Label htmlFor="gallery-title">Title</Label>
          <Input
            id="gallery-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gallery-url">Image address</Label>
          <Input
            id="gallery-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gallery-alt">Image description</Label>
          <Input id="gallery-alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gallery-category">Category</Label>
          <Input
            id="gallery-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          Show on public site <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        </label>
        <Button type="submit" disabled={mutation.isPending}>
          <Plus size={15} />
          Save image
        </Button>
        {notice && (
          <p role="status" className="text-xs text-muted-foreground">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}

function ContentAdmin({ items, panelKey }: { items: any[]; panelKey: AdminPanelKey }) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: { key: string; value: string; isPublished: boolean }) => saveResortContent({ data }),
  );
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({ key, value, isPublished });
    if (!mutation.isError) {
      setKey("");
      setValue("");
    }
  }
  return (
    <section className="grid gap-8 border-y border-border bg-background p-5 sm:p-7 lg:grid-cols-2">
      <div>
        <Eyebrow>Words & details</Eyebrow>
        <h2 className="mt-3 font-display text-3xl text-primary">Resort content</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Keep optional resort copy and page details here. Published entries can be connected to
            public pages as content is finalized.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {items.map((item) => (
              <article key={item.id} className="border-t border-border pt-4">
                <p className="text-xs font-medium text-resort-ocean">
                  {item.content_key} · {item.is_published ? "Published" : "Draft"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {String(item.content_value?.copy ?? "")}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
      <form
        className="grid content-start gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"
        onSubmit={submit}
      >
        <h3 className="font-display text-2xl text-primary">Add a content note</h3>
        <div className="grid gap-2">
          <Label htmlFor="content-key">Content key</Label>
          <Input id="content-key" value={key} onChange={(e) => setKey(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="content-value">Text</Label>
          <Textarea
            id="content-value"
            rows={5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          Publish entry <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        </label>
        <Button disabled={mutation.isPending}>
          <Check size={15} />
          Save content
        </Button>
        {notice && (
          <p role="status" className="text-xs text-muted-foreground">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}

const addonUnits: AddonUnit[] = ["per_person_per_night", "per_person", "per_night", "per_stay"];
const addonCategories: AddonCategory[] = ["food", "service", "activity"];

function AddonsAdmin({ items, panelKey }: { items: any[]; panelKey: AdminPanelKey }) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: Parameters<typeof saveAddon>[0]["data"]) => saveAddon({ data }),
  );
  const [category, setCategory] = useState<AddonCategory>("food");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<AddonUnit>("per_person_per_night");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      category,
      name,
      description,
      price: Number(price),
      unit,
      isActive: true,
    });
    setName("");
    setDescription("");
    setPrice("");
  }
  return (
    <section className="grid gap-8 border-y border-border bg-background p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <Eyebrow>Guests add these when they book</Eyebrow>
        <h2 className="mt-3 font-display text-3xl text-primary">Meals & extras</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing listed yet. Add breakfast, lunch, boat trips and other services.
          </p>
        ) : (
          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Price (৳)</TableHead>
                  <TableHead>Shown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <AddonRow key={item.id} item={item} onSave={(next) => mutation.mutate(next)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-xs text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
      <form
        onSubmit={submit}
        className="grid content-start gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"
      >
        <h3 className="font-display text-2xl text-primary">Add an item</h3>
        <div className="grid gap-2">
          <Label htmlFor="addon-category">Category</Label>
          <Select value={category} onValueChange={(v: AddonCategory) => setCategory(v)}>
            <SelectTrigger id="addon-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {addonCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="addon-name">Name</Label>
          <Input
            id="addon-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="addon-description">Short description</Label>
          <Input
            id="addon-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="addon-price">Price (৳)</Label>
            <Input
              id="addon-price"
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="addon-unit">Priced</Label>
            <Select value={unit} onValueChange={(v: AddonUnit) => setUnit(v)}>
              <SelectTrigger id="addon-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {addonUnits.map((u) => (
                  <SelectItem key={u} value={u}>
                    {unitLabel[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          <Plus size={15} />
          Add item
        </Button>
      </form>
    </section>
  );
}

function AddonRow({
  item,
  onSave,
}: {
  item: any;
  onSave: (next: Parameters<typeof saveAddon>[0]["data"]) => void;
}) {
  const [price, setPrice] = useState(String(item.price_cents / 100));
  const base = {
    id: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    unit: item.unit,
  };
  return (
    <TableRow>
      <TableCell className="min-w-48">
        <span className="block font-medium text-primary">{item.name}</span>
        <span className="text-xs text-muted-foreground">
          {categoryLabel[item.category as AddonCategory]} · {unitLabel[item.unit as AddonUnit]}
        </span>
      </TableCell>
      <TableCell>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...base, price: Number(price), isActive: item.is_active });
          }}
        >
          <Input
            aria-label={`Price for ${item.name}`}
            type="number"
            min="0"
            step="1"
            className="h-8 w-24"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button size="sm" variant="outline" type="submit">
            Save
          </Button>
        </form>
      </TableCell>
      <TableCell>
        <Switch
          checked={item.is_active}
          aria-label={`Show ${item.name}`}
          onCheckedChange={(checked) =>
            onSave({ ...base, price: item.price_cents / 100, isActive: checked })
          }
        />
      </TableCell>
    </TableRow>
  );
}

function RoomDetailsEditor({ room }: { room: any }) {
  const { mutation, notice } = useAdminMutation(
    "rooms",
    (data: Parameters<typeof updateRoomDetails>[0]["data"]) => updateRoomDetails({ data }),
  );
  const [f, setF] = useState({
    name: room.name ?? "",
    description: room.description ?? "",
    bedType: room.bed_type ?? "",
    sizeSqft: room.room_size_sqft ? String(room.room_size_sqft) : "",
    viewLabel: room.view_label ?? "",
    capacity: String(room.max_guests ?? 2),
    features: (room.features ?? []).join("\n"),
    imageUrl: room.image_url ?? "",
    galleryUrls: (room.gallery_urls ?? []).join("\n"),
    panoramaUrl: room.panorama_url ?? "",
    videoUrl: room.video_url ?? "",
  });
  const set =
    (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [key]: e.target.value });
  const id = (k: string) => `${k}-${room.id}`;
  return (
    <details className="mt-5 border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">
        Edit details, photos, 360° and video
      </summary>
      <form
        className="grid gap-4 border-t border-border p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({
            roomId: room.id,
            name: f.name,
            description: f.description,
            bedType: f.bedType,
            sizeSqft: f.sizeSqft ? Number(f.sizeSqft) : null,
            viewLabel: f.viewLabel,
            capacity: Number(f.capacity),
            features: f.features.split("\n"),
            imageUrl: f.imageUrl,
            galleryUrls: f.galleryUrls.split("\n"),
            panoramaUrl: f.panoramaUrl,
            videoUrl: f.videoUrl,
          });
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor={id("name")}>Name</Label>
          <Input id={id("name")} value={f.name} onChange={set("name")} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("view")}>View (e.g. Sea view)</Label>
          <Input id={id("view")} value={f.viewLabel} onChange={set("viewLabel")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("bed")}>Beds (e.g. 1 king bed)</Label>
          <Input id={id("bed")} value={f.bedType} onChange={set("bedType")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor={id("size")}>Size (sq ft)</Label>
            <Input
              id={id("size")}
              type="number"
              min="0"
              value={f.sizeSqft}
              onChange={set("sizeSqft")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={id("cap")}>Guests</Label>
            <Input
              id={id("cap")}
              type="number"
              min="1"
              max="20"
              value={f.capacity}
              onChange={set("capacity")}
              required
            />
          </div>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={id("desc")}>Description</Label>
          <Textarea id={id("desc")} rows={3} value={f.description} onChange={set("description")} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={id("feat")}>Amenities (one per line)</Label>
          <Textarea id={id("feat")} rows={4} value={f.features} onChange={set("features")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("cover")}>Cover photo link</Label>
          <Input
            id={id("cover")}
            type="url"
            value={f.imageUrl}
            onChange={set("imageUrl")}
            placeholder="https://"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("pano")}>360° photo link (2:1 panorama)</Label>
          <Input
            id={id("pano")}
            type="url"
            value={f.panoramaUrl}
            onChange={set("panoramaUrl")}
            placeholder="https://"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={id("video")}>Video link (YouTube, Facebook or .mp4)</Label>
          <Input
            id={id("video")}
            type="url"
            value={f.videoUrl}
            onChange={set("videoUrl")}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={id("gal")}>More photo links (one per line)</Label>
          <Textarea
            id={id("gal")}
            rows={3}
            value={f.galleryUrls}
            onChange={set("galleryUrls")}
            placeholder="https://..."
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            <Check size={15} />
            Save details
          </Button>
          {notice && (
            <p role="status" className="text-xs text-muted-foreground">
              {notice}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}

function ReviewsAdmin({ items, panelKey }: { items: any[]; panelKey: AdminPanelKey }) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: { reviewId: string; action: "publish" | "hide" | "delete" }) => moderateReview({ data }),
  );
  return (
    <section className="border-y border-border bg-background p-5 sm:p-7">
      <Eyebrow>Shown on the website only after you publish</Eyebrow>
      <h2 className="mt-3 font-display text-3xl text-primary">Guest reviews</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No reviews yet. Guests can write one from the home page.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((r) => (
            <article
              key={r.id}
              className={`border p-5 ${r.is_published ? "border-border" : "border-resort-gold bg-resort-cream/60"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-primary">
                  {r.guest_name}
                  {r.location && (
                    <span className="font-normal text-muted-foreground"> · {r.location}</span>
                  )}
                </p>
                <p className="text-sm text-resort-gold-deep" aria-label={`${r.rating} out of 5`}>
                  {"★".repeat(r.rating)}
                  <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">{r.comment}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()} ·{" "}
                {r.is_published ? "Published" : "Waiting for review"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.is_published ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mutation.mutate({ reviewId: r.id, action: "hide" })}
                  >
                    Hide
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => mutation.mutate({ reviewId: r.id, action: "publish" })}
                  >
                    <Check size={14} />
                    Publish
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm("Delete this review?"))
                      mutation.mutate({ reviewId: r.id, action: "delete" });
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {notice && (
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}

const orderFlow: { status: string; label: string }[] = [
  { status: "confirmed", label: "Confirm" },
  { status: "preparing", label: "Preparing" },
  { status: "served", label: "Served" },
];
const orderStatusStyle: Record<string, string> = {
  pending: "bg-resort-gold/20 text-resort-gold-deep",
  confirmed: "bg-resort-ocean-soft text-resort-ocean",
  preparing: "bg-resort-ocean-soft text-resort-ocean",
  served: "bg-muted text-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};
const deliveryLabel: Record<string, string> = {
  room: "To room",
  restaurant: "At restaurant",
  pickup: "Pickup",
};

function OrdersAdmin({ orders, panelKey }: { orders: any[]; panelKey: AdminPanelKey }) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: { orderId: string; status?: string; billStatus?: string }) => updateOrder({ data }),
  );
  const [filter, setFilter] = useState<"open" | "unbilled" | "all">("open");
  const open = orders.filter((o) => ["pending", "confirmed", "preparing"].includes(o.status));
  const unbilled = orders.filter((o) => o.status !== "cancelled" && o.bill_status === "unbilled");
  const unbilledTotal = unbilled.reduce((sum, o) => sum + o.subtotal_cents, 0);
  const shown = filter === "open" ? open : filter === "unbilled" ? unbilled : orders;

  return (
    <section className="border-y border-border bg-background p-5 sm:p-7">
      <Eyebrow>Food and service orders from guests</Eyebrow>
      <h2 className="mt-3 font-display text-3xl text-primary">Orders</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <p className="border border-border bg-resort-white p-4">
          <span className="block text-xs text-muted-foreground">Open orders</span>
          <span className="font-display text-3xl tabular-nums text-primary">{open.length}</span>
        </p>
        <p className="border border-border bg-resort-white p-4">
          <span className="block text-xs text-muted-foreground">Pending bills</span>
          <span className="font-display text-3xl tabular-nums text-primary">{unbilled.length}</span>
        </p>
        <p className="border border-border bg-resort-white p-4">
          <span className="block text-xs text-muted-foreground">Unbilled amount</span>
          <span className="font-display text-3xl tabular-nums text-primary">
            {formatMoney(unbilledTotal)}
          </span>
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter orders">
        {(
          [
            ["open", `Open (${open.length})`],
            ["unbilled", `Pending bills (${unbilled.length})`],
            ["all", `All (${orders.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`h-9 border px-4 text-xs transition-colors ${filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-resort-gold"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No orders here.</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {shown.map((o) => {
            const items = (o.service_order_items ?? []) as {
              name: string;
              quantity: number;
              line_total_cents: number;
            }[];
            const reference = (o.reservations as { booking_reference: string } | null)
              ?.booking_reference;
            return (
              <article key={o.id} className="border border-border bg-resort-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl tracking-[0.06em] text-primary">
                      {o.order_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs capitalize ${orderStatusStyle[o.status] ?? ""}`}
                  >
                    {o.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-foreground">
                  {o.guest_name} · {o.guest_phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {deliveryLabel[o.delivery]}
                  {o.room_label ? ` · Room ${o.room_label}` : ""}
                  {reference ? ` · Booking ${reference}` : ""}
                </p>
                <ul className="mt-3 grid gap-1 border-y border-border py-3 text-sm">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-3">
                      <span>
                        {i.name} × {i.quantity}
                      </span>
                      <span className="tabular-nums">{formatMoney(i.line_total_cents)}</span>
                    </li>
                  ))}
                </ul>
                {o.note && <p className="mt-2 text-xs text-foreground">Note: {o.note}</p>}
                <p className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="font-display text-xl tabular-nums text-primary">
                    {formatMoney(o.subtotal_cents)}
                  </span>
                </p>
                {o.status !== "cancelled" && o.status !== "served" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {orderFlow.map((step) => (
                      <Button
                        key={step.status}
                        size="sm"
                        variant={o.status === step.status ? "default" : "outline"}
                        disabled={mutation.isPending || o.status === step.status}
                        onClick={() => mutation.mutate({ orderId: o.id, status: step.status })}
                      >
                        {step.label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={mutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Cancel order ${o.order_number}?`))
                          mutation.mutate({ orderId: o.id, status: "cancelled" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {o.status !== "cancelled" && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Bill:</span>
                    {(["unbilled", "billed", "paid"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ orderId: o.id, billStatus: b })}
                        className={`h-8 border px-3 capitalize transition-colors ${o.bill_status === b ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-resort-gold"}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {notice && (
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}

const menuCategories = [
  { key: "food", label: "Food" },
  { key: "drinks", label: "Drinks" },
  { key: "service", label: "Services" },
  { key: "activity", label: "Activities" },
] as const;

function MenuAdmin({ items, panelKey }: { items: any[]; panelKey: AdminPanelKey }) {
  const { mutation, notice } = useAdminMutation(
    panelKey,
    (data: Parameters<typeof saveMenuItem>[0]["data"]) => saveMenuItem({ data }),
  );
  const [category, setCategory] = useState<(typeof menuCategories)[number]["key"]>("food");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      category,
      name,
      description,
      price: Number(price),
      imageUrl,
      isAvailable: true,
    });
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
  }
  return (
    <section className="grid gap-8 border-y border-border bg-background p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <Eyebrow>Guests order these from the Order page</Eyebrow>
        <h2 className="mt-3 font-display text-3xl text-primary">Menu</h2>
        {menuCategories.map((c) => {
          const list = items.filter((i) => i.category === c.key);
          if (list.length === 0) return null;
          return (
            <div key={c.key} className="mt-6">
              <h3 className="text-sm font-medium text-primary">{c.label}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price (৳)</TableHead>
                    <TableHead>On menu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((item) => (
                    <MenuRow key={item.id} item={item} onSave={(next) => mutation.mutate(next)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
        {notice && (
          <p role="status" className="mt-4 text-xs text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
      <form
        onSubmit={submit}
        className="grid content-start gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"
      >
        <h3 className="font-display text-2xl text-primary">Add a menu item</h3>
        <div className="grid gap-2">
          <Label htmlFor="menu-category">Category</Label>
          <Select
            value={category}
            onValueChange={(v: (typeof menuCategories)[number]["key"]) => setCategory(v)}
          >
            <SelectTrigger id="menu-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {menuCategories.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="menu-name">Name</Label>
          <Input
            id="menu-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="menu-description">Short description</Label>
          <Input
            id="menu-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="menu-price">Price (৳)</Label>
          <Input
            id="menu-price"
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="menu-image">Photo link (optional)</Label>
          <Input
            id="menu-image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          <Plus size={15} />
          Add item
        </Button>
      </form>
    </section>
  );
}

function MenuRow({
  item,
  onSave,
}: {
  item: any;
  onSave: (next: Parameters<typeof saveMenuItem>[0]["data"]) => void;
}) {
  const [price, setPrice] = useState(String(item.price_cents / 100));
  const base = {
    id: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    imageUrl: item.image_url ?? "",
  };
  return (
    <TableRow>
      <TableCell className="min-w-44">
        <span className="block font-medium text-primary">{item.name}</span>
        <span className="line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
      </TableCell>
      <TableCell>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...base, price: Number(price), isAvailable: item.is_available });
          }}
        >
          <Input
            aria-label={`Price for ${item.name}`}
            type="number"
            min="0"
            step="1"
            className="h-8 w-24"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button size="sm" variant="outline" type="submit">
            Save
          </Button>
        </form>
      </TableCell>
      <TableCell>
        <Switch
          checked={item.is_available}
          aria-label={`Show ${item.name} on the menu`}
          onCheckedChange={(checked) =>
            onSave({ ...base, price: item.price_cents / 100, isAvailable: checked })
          }
        />
      </TableCell>
    </TableRow>
  );
}
