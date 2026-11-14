// Global Website Template Engine registry.
//
// Every platform template a Master Admin can create is described here:
// display label, marketing copy for the public homepage, and the vocabulary
// used for the generic customer/admin "records" engine (e.g. a loan platform
// calls its records "Loan Applications", an e-commerce platform calls them
// "Orders"). Banking and Tracking have bespoke, fully custom portals and are
// not routed through the generic engine, but are still listed here for the
// homepage + admin dashboard label lookups.
import {
  Banknote,
  BarChart2,
  Bitcoin,
  CircleHelp,
  GraduationCap,
  Hospital,
  Home,
  Hotel,
  Landmark,
  Package,
  Plane,
  Shield,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Coins,
  type LucideIcon,
} from "lucide-react";

export type TemplateType =
  | "banking"
  | "tracking"
  | "forex"
  | "investment"
  | "crypto"
  | "digital_wallet"
  | "loan"
  | "ecommerce"
  | "real_estate"
  | "insurance"
  | "airline"
  | "logistics"
  | "hospital"
  | "school"
  | "hotel"
  | "crowdfunding"
  | "microfinance";

export interface TemplateConfig {
  type: TemplateType | "unknown";
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  features: string[];
  recordLabelSingular: string;
  recordLabelPlural: string;
  recordCategory: string;
  actionLabel: string;
  /** Whether this template has a bespoke, hand-built portal instead of the generic engine */
  bespoke: boolean;
}

export interface ServerCapabilities {
  payment?: boolean;
  customerAccounts?: boolean;
  accountNumber?: boolean;
  kycSupported?: boolean;
  teamReview?: boolean;
  customerFeatures?: string[];
  adminFeatures?: string[];
  recordLabelSingular?: string;
  recordLabelPlural?: string;
  recordCategory?: string | null;
  actionLabel?: string | null;
}

export const TEMPLATE_REGISTRY: Record<TemplateType, TemplateConfig> = {
  banking: {
    type: "banking", label: "Online Banking", emoji: "🏦",
    tagline: "Modern banking, built for trust.",
    description: "Open accounts, move money, and manage cards from one secure dashboard.",
    features: ["Instant transfers", "Virtual & physical cards", "Bank-grade KYC security"],
    recordLabelSingular: "Transaction", recordLabelPlural: "Transactions", recordCategory: "transaction",
    actionLabel: "Open an Account", bespoke: true,
  },
  tracking: {
    type: "tracking", label: "Package Tracking", emoji: "📦",
    tagline: "Know exactly where your package is.",
    description: "Real-time shipment tracking, delivery timelines, and billing in one place.",
    features: ["Live tracking updates", "Delivery timeline history", "Billing & receipts"],
    recordLabelSingular: "Shipment", recordLabelPlural: "Shipments", recordCategory: "shipment",
    actionLabel: "Track a Shipment", bespoke: true,
  },
  forex: {
    type: "forex", label: "Forex Trading", emoji: "📈",
    tagline: "Trade global currency markets with confidence.",
    description: "Live rates, open positions, and a funded wallet to trade the world's currencies.",
    features: ["Real-time currency pairs", "Position & wallet management", "Fast fund settlement"],
    recordLabelSingular: "Position", recordLabelPlural: "Positions", recordCategory: "forex_position",
    actionLabel: "Open a Position", bespoke: true,
  },
  investment: {
    type: "investment", label: "Investment Platform", emoji: "💹",
    tagline: "Grow your wealth with guided investment plans.",
    description: "Choose an investment plan, track ROI, and manage your portfolio in real time.",
    features: ["Curated investment plans", "ROI & portfolio tracking", "Secure withdrawals"],
    recordLabelSingular: "Investment", recordLabelPlural: "Investments", recordCategory: "investment",
    actionLabel: "Start Investing", bespoke: true,
  },
  crypto: {
    type: "crypto", label: "Crypto Exchange", emoji: "₿",
    tagline: "Buy, sell, and hold crypto with ease.",
    description: "Trade digital assets with real-time pricing and a secure multi-currency wallet.",
    features: ["Spot trading pairs", "Multi-currency wallet", "Instant order execution"],
    recordLabelSingular: "Trade", recordLabelPlural: "Trades", recordCategory: "crypto_trade",
    actionLabel: "New Trade", bespoke: true,
  },
  digital_wallet: {
    type: "digital_wallet", label: "Digital Wallet", emoji: "💳",
    tagline: "Send, receive, and pay — instantly.",
    description: "A digital wallet for P2P transfers, QR payments, and everyday spending.",
    features: ["P2P instant transfers", "QR code payments", "Spending insights"],
    recordLabelSingular: "Payment", recordLabelPlural: "Payments", recordCategory: "wallet_payment",
    actionLabel: "Send Payment", bespoke: false,
  },
  loan: {
    type: "loan", label: "Loan Management", emoji: "🏛️",
    tagline: "Fast approvals, transparent repayments.",
    description: "Apply for loans, track approval status, and manage repayment schedules.",
    features: ["Quick loan applications", "Transparent repayment schedules", "Real-time approval status"],
    recordLabelSingular: "Loan Application", recordLabelPlural: "Loan Applications", recordCategory: "loan_application",
    actionLabel: "Apply for a Loan", bespoke: false,
  },
  ecommerce: {
    type: "ecommerce", label: "E-Commerce", emoji: "🛒",
    tagline: "Shop smarter, checkout faster.",
    description: "Browse products, place orders, and track fulfillment from your account.",
    features: ["Fast, secure checkout", "Order tracking", "Order history & receipts"],
    recordLabelSingular: "Order", recordLabelPlural: "Orders", recordCategory: "order",
    actionLabel: "Place an Order", bespoke: false,
  },
  real_estate: {
    type: "real_estate", label: "Real Estate", emoji: "🏠",
    tagline: "Find, book, and manage properties.",
    description: "Browse listings, submit inquiries, and manage bookings on one platform.",
    features: ["Curated property listings", "Booking & inquiry tracking", "Agent-managed approvals"],
    recordLabelSingular: "Property Inquiry", recordLabelPlural: "Property Inquiries", recordCategory: "property_inquiry",
    actionLabel: "Submit Inquiry", bespoke: false,
  },
  insurance: {
    type: "insurance", label: "Insurance", emoji: "🛡️",
    tagline: "Coverage you can count on.",
    description: "Manage policies, file claims, and track claim status with full transparency.",
    features: ["Policy management", "Fast claim filing", "Real-time claim status"],
    recordLabelSingular: "Policy / Claim", recordLabelPlural: "Policies & Claims", recordCategory: "policy",
    actionLabel: "File a Claim", bespoke: false,
  },
  airline: {
    type: "airline", label: "Airline", emoji: "✈️",
    tagline: "Book your next flight in minutes.",
    description: "Search flights, book tickets, and manage your itinerary in one place.",
    features: ["Flight booking", "Itinerary management", "Booking status tracking"],
    recordLabelSingular: "Booking", recordLabelPlural: "Bookings", recordCategory: "flight_booking",
    actionLabel: "Book a Flight", bespoke: false,
  },
  logistics: {
    type: "logistics", label: "Logistics", emoji: "🚛",
    tagline: "End-to-end logistics, fully visible.",
    description: "Manage freight, fleet assignments, and delivery orders from a single dashboard.",
    features: ["Freight order management", "Fleet visibility", "Delivery status tracking"],
    recordLabelSingular: "Freight Order", recordLabelPlural: "Freight Orders", recordCategory: "freight_order",
    actionLabel: "Create Freight Order", bespoke: false,
  },
  hospital: {
    type: "hospital", label: "Hospital", emoji: "🏥",
    tagline: "Care coordination made simple.",
    description: "Book appointments, view medical records access, and manage visits.",
    features: ["Appointment booking", "Visit history", "Status updates from staff"],
    recordLabelSingular: "Appointment", recordLabelPlural: "Appointments", recordCategory: "appointment",
    actionLabel: "Book Appointment", bespoke: false,
  },
  school: {
    type: "school", label: "School", emoji: "🎓",
    tagline: "Learning, organized.",
    description: "Manage enrollment, track course progress, and stay on top of school updates.",
    features: ["Course enrollment", "Progress tracking", "Admin announcements"],
    recordLabelSingular: "Enrollment", recordLabelPlural: "Enrollments", recordCategory: "enrollment",
    actionLabel: "Enroll in a Course", bespoke: false,
  },
  hotel: {
    type: "hotel", label: "Hotel", emoji: "🏨",
    tagline: "Book your stay, hassle-free.",
    description: "Browse rooms, book stays, and manage reservations from your account.",
    features: ["Room booking", "Reservation management", "Booking status tracking"],
    recordLabelSingular: "Reservation", recordLabelPlural: "Reservations", recordCategory: "reservation",
    actionLabel: "Book a Room", bespoke: false,
  },
  crowdfunding: {
    type: "crowdfunding", label: "Crowdfunding", emoji: "🤝",
    tagline: "Fund ideas that matter.",
    description: "Back campaigns, track pledges, and follow campaign progress in real time.",
    features: ["Campaign browsing", "Pledge tracking", "Backer updates"],
    recordLabelSingular: "Pledge", recordLabelPlural: "Pledges", recordCategory: "pledge",
    actionLabel: "Back a Campaign", bespoke: false,
  },
  microfinance: {
    type: "microfinance", label: "Microfinance", emoji: "💰",
    tagline: "Small loans, real impact.",
    description: "Access micro-loans and savings groups with transparent, fast approvals.",
    features: ["Micro-loan applications", "Savings group tracking", "Transparent repayment status"],
    recordLabelSingular: "Micro-loan", recordLabelPlural: "Micro-loans", recordCategory: "microloan",
    actionLabel: "Apply for a Micro-loan", bespoke: false,
  },
};

const UNKNOWN_TEMPLATE_CONFIG: TemplateConfig = {
  type: "unknown",
  label: "Service Portal",
  emoji: "•",
  tagline: "Service portal",
  description: "This service type is not available.",
  features: [],
  recordLabelSingular: "Record",
  recordLabelPlural: "Records",
  recordCategory: "",
  actionLabel: "",
  bespoke: false,
};

/** Canonical service sign used by loaders and type displays. This is not a company logo. */
export const SERVICE_SIGN_ICONS: Record<TemplateType, LucideIcon> = {
  banking: Banknote,
  tracking: Package,
  forex: TrendingUp,
  investment: BarChart2,
  crypto: Bitcoin,
  digital_wallet: Wallet,
  loan: Landmark,
  ecommerce: ShoppingCart,
  real_estate: Home,
  insurance: Shield,
  airline: Plane,
  logistics: Truck,
  hospital: Hospital,
  school: GraduationCap,
  hotel: Hotel,
  crowdfunding: Users,
  microfinance: Coins,
};

export function getServiceSignIcon(type: string | null | undefined): LucideIcon {
  return SERVICE_SIGN_ICONS[type as TemplateType] ?? CircleHelp;
}

export function getTemplateConfig(
  type: string | undefined | null,
  capabilities?: ServerCapabilities | null,
): TemplateConfig {
  const base = type && type in TEMPLATE_REGISTRY
    ? TEMPLATE_REGISTRY[type as TemplateType]
    : UNKNOWN_TEMPLATE_CONFIG;
  if (!capabilities) return base;
  return {
    ...base,
    recordLabelSingular: capabilities.recordLabelSingular ?? base.recordLabelSingular,
    recordLabelPlural: capabilities.recordLabelPlural ?? base.recordLabelPlural,
    recordCategory: capabilities.recordCategory ?? base.recordCategory,
    actionLabel: capabilities.actionLabel ?? base.actionLabel,
  };
}

/** Templates routed through the generic Template Engine (not bespoke). */
export function isGenericTemplate(type: string | undefined | null): boolean {
  const cfg = type && type in TEMPLATE_REGISTRY ? TEMPLATE_REGISTRY[type as TemplateType] : null;
  return !!cfg && !cfg.bespoke;
}

/** Payment UI follows the server-resolved capability payload. */
export function supportsPayments(capabilities: { payment?: boolean } | null | undefined): boolean {
  return capabilities?.payment === true;
}
