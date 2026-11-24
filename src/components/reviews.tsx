import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, PenLine, Quote, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/resort-site";
import { supabase } from "@/integrations/supabase/client";

type Review = {
  id: string;
  guest_name: string;
  location: string;
  rating: number;
  comment: string;
  stay_label: string;
  created_at: string;
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.5}
          className={n <= Math.round(value) ? "fill-resort-gold text-resort-gold" : "text-border"}
        />
      ))}
    </span>
  );
}

function ReviewForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // left empty by people, filled by bots
  const [error, setError] = useState("");
  const submit = useMutation({
    mutationFn: async () => {
      if (website) return;
      const { error: insertError } = await supabase.from("guest_reviews").insert({
        guest_name: name.trim(),
        location: location.trim(),
        rating,
        comment: comment.trim(),
      });
      if (insertError) throw new Error("We couldn't send your review. Please try again.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "We couldn't send your review."),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Please enter your name");
    if (comment.trim().length < 10)
      return setError("Please write at least a sentence about your stay");
    submit.mutate();
  }

  if (submit.isSuccess)
    return (
      <div className="py-6 text-center">
        <CircleCheck size={36} className="mx-auto text-resort-ocean" />
        <p className="mt-4 font-display text-2xl text-primary">Thank you for your review</p>
        <p className="mt-2 text-sm text-muted-foreground">
          It will appear on the website once the resort has read it.
        </p>
        <Button className="mt-6 rounded-none" onClick={onDone}>
          Close
        </Button>
      </div>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className="rounded-sm p-1 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resort-teal active:scale-95"
            >
              <Star
                size={28}
                strokeWidth={1.5}
                className={n <= rating ? "fill-resort-gold text-resort-gold" : "text-border"}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="review-name">Your name</Label>
          <Input
            id="review-name"
            className="h-11 rounded-none"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-location">
            From <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="review-location"
            className="h-11 rounded-none"
            placeholder="e.g. Dhaka"
            value={location}
            maxLength={60}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="review-comment">Your review</Label>
        <Textarea
          id="review-comment"
          rows={5}
          className="rounded-none"
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you enjoy? What should other guests know?"
        />
        <span className="text-right text-xs tabular-nums text-muted-foreground">
          {comment.length} / 1000
        </span>
      </div>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={submit.isPending}
        className="h-12 rounded-none bg-resort-gold text-[13px] font-medium text-resort-wood hover:bg-primary hover:text-primary-foreground"
      >
        {submit.isPending ? <LoaderCircle size={16} className="animate-spin" /> : "Send review"}
      </Button>
    </form>
  );
}

export function ReviewsSection() {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["guest-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_reviews")
        .select("id, guest_name, location, rating, comment, stay_label, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw new Error("Reviews couldn't be loaded.");
      return (data ?? []) as Review[];
    },
  });
  const reviews = query.data ?? [];
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section
      className="bg-resort-white px-6 py-24 sm:px-8 lg:py-28"
      aria-labelledby="reviews-title"
    >
      <div className="mx-auto max-w-[1180px]">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div id="reviews-title">
            <SectionHeading eyebrow="Guest reviews" title="What our guests say" />
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {reviews.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-display text-4xl tabular-nums text-primary">
                  {average.toFixed(1)}
                </span>
                <span>
                  <Stars value={average} />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                  </span>
                </span>
              </div>
            )}
            {reviews.length > 0 && (
              <Button
                variant="outline"
                className="h-11 rounded-none border-primary/30"
                onClick={() => setOpen(true)}
              >
                <PenLine size={15} /> Write a review
              </Button>
            )}
          </div>
        </Reveal>

        {query.isLoading && (
          <div
            className="mt-12 grid gap-6 md:grid-cols-3"
            role="status"
            aria-label="Loading reviews"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse bg-resort-cream" />
            ))}
          </div>
        )}

        {!query.isLoading && reviews.length === 0 && (
          <Reveal className="mt-12 flex flex-col items-start gap-4 bg-resort-cream p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <Quote size={28} strokeWidth={1.25} className="shrink-0 text-resort-gold-deep" />
              <div>
                <p className="font-display text-xl text-primary">
                  Stayed with us? Tell others about it
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reviews from guests appear here after the resort has read them.
                </p>
              </div>
            </div>
            <Button
              className="h-11 rounded-none bg-resort-gold px-6 text-[13px] font-medium text-resort-wood hover:bg-primary hover:text-primary-foreground"
              onClick={() => setOpen(true)}
            >
              Write the first review
            </Button>
          </Reveal>
        )}

        {reviews.length > 0 && (
          <div className="-mx-6 mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {reviews.slice(0, 6).map((r, i) => (
              <Reveal
                key={r.id}
                delay={i * 80}
                as="figure"
                className="flex w-[82vw] shrink-0 snap-start flex-col bg-resort-cream p-7 sm:w-auto"
              >
                <Stars value={r.rating} />
                <blockquote className="mt-5 flex-1 text-[15px] leading-7 text-foreground">
                  “{r.comment}”
                </blockquote>
                <figcaption className="mt-6 border-t border-border pt-4">
                  <span className="block font-medium text-primary">{r.guest_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[
                      r.location,
                      r.stay_label ||
                        new Date(r.created_at).toLocaleDateString("en-GB", {
                          month: "long",
                          year: "numeric",
                        }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </figcaption>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogTitle className="font-display text-2xl font-normal text-primary">
            Write a review
          </DialogTitle>
          <DialogDescription>
            Your review appears on the website after the resort has read it.
          </DialogDescription>
          <ReviewForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
