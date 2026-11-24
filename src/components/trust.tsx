import { useRouterState } from "@tanstack/react-router";
import {
  BedDouble,
  MessageCircle,
  Phone,
  UserRoundCheck,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { resortContact } from "@/lib/resort-content";

const promises = [
  { Icon: UserRoundCheck, title: "No account needed", copy: "Book with your name and mobile" },
  {
    Icon: Wallet,
    title: "No payment to request",
    copy: "The resort explains payment when it calls",
  },
  { Icon: BedDouble, title: "Rooms held for you", copy: "While the resort confirms your request" },
  {
    Icon: UtensilsCrossed,
    title: "Meals and trips in one go",
    copy: "Add them to the same booking",
  },
];

/** Plain facts about how booking works, shown where guests decide. */
export function TrustStrip() {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 px-1 sm:mt-6 sm:gap-x-6 sm:gap-y-5 lg:grid-cols-4">
      {promises.map(({ Icon, title, copy }) => (
        <li key={title} className="flex items-center gap-2 sm:items-start sm:gap-3">
          <Icon size={18} strokeWidth={1.5} className="shrink-0 text-resort-gold-deep sm:mt-0.5" />
          <span>
            <span className="block text-xs font-medium text-primary sm:text-[13px]">{title}</span>
            <span className="hidden text-xs leading-5 text-muted-foreground sm:block">{copy}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Floating WhatsApp / call button. Appears once a number is set in resort-content.ts. */
export function ContactFloat() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { whatsapp, phone } = resortContact;
  if (!whatsapp && !phone) return null;
  if (pathname.startsWith("/admin")) return null;
  const href = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hello, I'd like to ask about a stay at Santa Monica Eco Beach Resort.")}`
    : `tel:${phone}`;
  return (
    <a
      href={href}
      target={whatsapp ? "_blank" : undefined}
      rel="noreferrer"
      aria-label={whatsapp ? "Chat with the resort on WhatsApp" : "Call the resort"}
      className={`fixed right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground shadow-[0_8px_24px_color-mix(in_oklab,var(--resort-wood)_25%,transparent)] transition-colors hover:bg-resort-gold hover:text-resort-wood sm:right-6 bottom-24 lg:bottom-6`}
    >
      {whatsapp ? <MessageCircle size={20} /> : <Phone size={20} />}
      <span className="hidden sm:inline">{whatsapp ? "Ask on WhatsApp" : "Call us"}</span>
    </a>
  );
}
