export type HomepageCopyItem = {
  title: string;
  body: string;
};

export type HomepageCopySection = {
  heading: string;
  description: string;
  items: HomepageCopyItem[];
};

export type HomepageCopyOverride = {
  heading?: string;
  description?: string;
  items?: ReadonlyArray<{
    title?: string;
    body?: string;
  }>;
};

export const BANKING_SERVICES_COPY: HomepageCopySection = {
  heading: "Banking Services",
  description:
    "Explore the banking tools available on this website. The options you can use depend on your account and the services enabled for this website.",
  items: [
    {
      title: "Account overview",
      body: "Review your account details, balances, and recent activity in your customer portal.",
    },
    {
      title: "Transfers",
      body: "Submit eligible transfer requests and follow their review status in your account.",
    },
    {
      title: "Card services",
      body: "View available card tools and track card requests when this service is enabled.",
    },
    {
      title: "Deposits and funding",
      body: "See the funding methods configured for this website and follow the instructions shown for your account.",
    },
  ],
};

export const BANKING_KYC_COPY: HomepageCopySection = {
  heading: "KYC Information",
  description:
    "Know Your Customer (KYC) checks help verify identity when required. If your account needs verification, the customer portal will show the requested information and next steps.",
  items: [
    {
      title: "When verification is needed",
      body: "Verification may be requested to confirm account details or meet applicable requirements.",
    },
    {
      title: "Provide requested details",
      body: "Your customer portal lists the information or documents requested for your account.",
    },
    {
      title: "Check your status",
      body: "Review whether your submission is pending, complete, or needs more information.",
    },
    {
      title: "Need help?",
      body: "Use the support contact published on this website if you have a question about verification.",
    },
  ],
};

export const WHY_CHOOSE_US_COPY: HomepageCopySection = {
  heading: "Why Choose Us",
  description:
    "Find service information, follow request updates, and access the support details published for this website. Available features depend on your account and website configuration.",
  items: [
    {
      title: "Clear service information",
      body: "Review what each available service does and any requirements shown before submitting a request.",
    },
    {
      title: "Follow your requests",
      body: "Check status updates for requests submitted through your customer portal.",
    },
    {
      title: "Support details in one place",
      body: "Use the contact information published on this website when you need help.",
    },
  ],
};

export const GENERIC_SERVICES_COPY: HomepageCopySection = {
  heading: "Services",
  description:
    "Explore the features available on this website. Your account portal shows which options are enabled for your account.",
  items: [],
};

export const GENERIC_HOW_IT_WORKS_COPY: HomepageCopySection = {
  heading: "How It Works",
  description: "A simple way to get started and manage the services available to your account.",
  items: [
    {
      title: "Create an account",
      body: "Register using the information requested on this website.",
    },
    {
      title: "Explore available services",
      body: "Sign in to review the features and options enabled for your account.",
    },
    {
      title: "Submit a request",
      body: "Follow the instructions shown for the service or action you want to use.",
    },
    {
      title: "Follow your activity",
      body: "Review your requests and their status in your customer portal.",
    },
  ],
};

export const GENERIC_FAQ_COPY = {
  heading: "Frequently Asked Questions",
  items: [
    {
      question: "Which services can I use?",
      answer: "Available services depend on this website's configuration and your account. Sign in to see the options available to you.",
    },
    {
      question: "How do I get started?",
      answer: "Create an account using the registration option on this website, then sign in to review your available services.",
    },
    {
      question: "Where can I check a request?",
      answer: "Sign in to your customer portal to review requests and any status updates shown for your account.",
    },
    {
      question: "How can I contact support?",
      answer: "Use the support details published in the Contact section of this website.",
    },
  ],
};

export const BANKING_HOW_IT_WORKS_COPY: HomepageCopySection = {
  heading: "How It Works",
  description: "Use your account portal to review available banking tools and follow requests.",
  items: [
    {
      title: "Open an account",
      body: "Register on this website and review the account information requested.",
    },
    {
      title: "Review your options",
      body: "Sign in to see the banking services enabled for your account.",
    },
    {
      title: "Send a request",
      body: "Choose an available service and follow its instructions before submitting.",
    },
    {
      title: "Check your activity",
      body: "Return to your portal to review activity and request status updates.",
    },
  ],
};

export const BANKING_FAQ_COPY = {
  heading: "Frequently Asked Questions",
  items: [
    {
      question: "Which banking services are available?",
      answer: "Available services depend on this website's configuration and your account. Sign in to review the options shown in your portal.",
    },
    {
      question: "Where can I review account activity?",
      answer: "Your customer portal displays the account information and activity available to your account.",
    },
    {
      question: "Where can I check verification information?",
      answer: "If verification information is needed, your customer portal shows the requested details and status for your account.",
    },
    {
      question: "How can I contact support?",
      answer: "Use the support contact details published in the Contact section of this website.",
    },
  ],
};

export const BANKING_SECURITY_COPY = {
  heading: "Security Information",
  description:
    "Review the account guidance and verification requirements shown for your account. Use the customer portal and the support contacts published on this website for account-related questions.",
};

export function resolveHomepageCopy(
  override: HomepageCopyOverride | null | undefined,
  defaults: HomepageCopySection,
): HomepageCopySection {
  const clean = (value: string | undefined, fallback: string) =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

  const suppliedItems = (override?.items ?? []).filter(
    (item) => Boolean(item.title?.trim() || item.body?.trim()),
  );
  const sourceItems = suppliedItems.length ? suppliedItems : defaults.items;
  const fallbackItem = defaults.items[0] ?? {
    title: "More information",
    body: defaults.description,
  };

  return {
    heading: clean(override?.heading, defaults.heading),
    description: clean(override?.description, defaults.description),
    items: sourceItems.map((item, index) => {
      const fallback = defaults.items[index] ?? fallbackItem;
      return {
        title: clean(item.title, fallback.title),
        body: clean(item.body, fallback.body),
      };
    }),
  };
}
