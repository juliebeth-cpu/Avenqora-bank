export interface PublicLegalCapabilities {
  customerAccounts?: boolean;
  accountNumber?: boolean;
  wallet?: boolean;
  balance?: boolean;
  financialTransactions?: boolean;
  transactionPin?: boolean;
  payment?: boolean;
  kycSupported?: boolean;
  kyc?: {
    enabled?: boolean;
  };
}

export interface PublicLegalSite {
  type?: string | null;
  capabilities?: PublicLegalCapabilities | null;
}

export interface PublicLegalProfile {
  serviceName: string;
  introduction: string;
  collectedInformation: string[];
  usePurposes: string[];
  legalBases: string[];
  serviceTermsTitle: string;
  serviceTermsBody: string;
  serviceTermsItems: string[];
  retention: string;
  eligibility: string;
  childrenPrivacy: string;
  hasFinancialRecords: boolean;
  hasKyc: boolean;
  hasAccounts: boolean;
  hasPayment: boolean;
}

const PROFILES: Record<string, Omit<PublicLegalProfile, "hasKyc" | "hasAccounts" | "hasPayment">> = {
  banking: {
    serviceName: "banking and account services",
    introduction: "This policy explains how information is handled when you use banking, account, payment, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, date of birth, email address, phone number, and address",
      "Account information, balances, transaction history, payment details, and account activity",
      "Identity verification and KYC/AML information when required for your account or a regulated service",
      "Transaction-security information used to protect account actions, such as a customer transaction PIN; the PIN is protected and is not stored in plain text",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Open and maintain accounts and provide the banking services you request",
      "Process deposits, withdrawals, transfers, payments, and related confirmations",
      "Verify identity, prevent fraud, secure accounts, and meet applicable financial and AML/KYC obligations",
      "Provide support, service notices, statements, and account security alerts",
    ],
    legalBases: [
      "Contractual necessity to provide the account or service you request",
      "Legal obligation where financial, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Banking Services & Transactions",
    serviceTermsBody: "Banking services, account features, and transactions are provided subject to applicable limits, review requirements, service notices, and law.",
    serviceTermsItems: [
      "You are responsible for providing accurate account and transaction information",
      "Transactions may be reviewed, delayed, limited, reversed, or declined for security, compliance, or error correction",
      "Keep passwords and transaction-security credentials confidential and report unauthorized activity promptly",
    ],
    retention: "We retain account, identity, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal and financial recordkeeping obligations.",
    eligibility: "You must meet the legal and account eligibility requirements shown during registration. Additional requirements may apply to particular banking services.",
    childrenPrivacy: "These services are not directed to children under 18 unless a specific service expressly permits participation with the required parent, guardian, or legal authorization.",
    hasFinancialRecords: true,
  },
  investment: {
    serviceName: "investment services",
    introduction: "This policy explains how information is handled when you use investment accounts, plans, portfolio, and related support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, date of birth, email address, phone number, and address",
      "Investment account, plan, portfolio, order, deposit, withdrawal, and transaction information",
      "Identity verification and KYC/AML information required for investment services",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Create and administer investment accounts, plans, portfolios, and requested services",
      "Process investments, deposits, withdrawals, statements, notices, and service requests",
      "Verify identity, prevent fraud, secure accounts, and meet applicable financial and KYC obligations",
      "Provide support, service updates, and information needed to administer your account",
    ],
    legalBases: [
      "Contractual necessity to provide the investment service you request",
      "Legal obligation where financial, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Investment Services",
    serviceTermsBody: "Investment information and services are provided subject to the applicable plan terms, eligibility rules, review requirements, limits, and risk notices shown before you proceed.",
    serviceTermsItems: [
      "You are responsible for reviewing information and providing accurate account or investment instructions",
      "Requests may be reviewed, delayed, limited, or declined for compliance, security, availability, or error correction",
      "Past performance, estimates, or displayed information do not guarantee future results",
    ],
    retention: "We retain account, identity, portfolio, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal and financial recordkeeping obligations.",
    eligibility: "You must meet the legal and service eligibility requirements shown during registration and before using an investment feature.",
    childrenPrivacy: "Investment services are not directed to children under 18.",
    hasFinancialRecords: true,
  },
  forex: {
    serviceName: "foreign-exchange trading services",
    introduction: "This policy explains how information is handled when you use trading accounts, currency pairs, funding, orders, positions, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, date of birth, email address, phone number, and address",
      "Trading account, funding, deposit, withdrawal, order, position, and trading activity information",
      "Identity verification and KYC/AML information required for trading services",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Create and administer your trading account and provide requested trading features",
      "Process funding, deposits, withdrawals, orders, positions, confirmations, and account notices",
      "Verify identity, prevent fraud, secure accounts, and meet applicable financial and KYC obligations",
      "Provide support, service updates, and records needed to administer your account",
    ],
    legalBases: [
      "Contractual necessity to provide the trading service you request",
      "Legal obligation where financial, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Foreign-Exchange Trading",
    serviceTermsBody: "Trading features are provided subject to the applicable eligibility requirements, trading rules, pricing information, limits, review requirements, and risk notices shown through the service.",
    serviceTermsItems: [
      "You are responsible for reviewing order details and providing accurate trading instructions",
      "Orders, funding requests, or withdrawals may be reviewed, delayed, limited, rejected, or cancelled for security, compliance, market, or operational reasons",
      "Foreign-exchange trading involves risk; displayed prices, estimates, and information do not guarantee a result",
    ],
    retention: "We retain account, identity, trading, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal and financial recordkeeping obligations.",
    eligibility: "You must meet the legal and service eligibility requirements shown during registration and before using trading features.",
    childrenPrivacy: "Foreign-exchange trading services are not directed to children under 18.",
    hasFinancialRecords: true,
  },
  crypto: {
    serviceName: "digital-asset and wallet services",
    introduction: "This policy explains how information is handled when you use digital-asset wallets, balances, deposits, withdrawals, trades, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, date of birth, email address, phone number, and address",
      "Wallet, asset, balance, deposit, withdrawal, order, trade, and transaction information",
      "Identity verification and KYC/AML information required for digital-asset services",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Create and administer your wallet and provide requested digital-asset services",
      "Process deposits, withdrawals, trades, orders, balances, confirmations, and account notices",
      "Verify identity, prevent fraud, secure accounts, and meet applicable financial and KYC obligations",
      "Provide support, service updates, and records needed to administer your account",
    ],
    legalBases: [
      "Contractual necessity to provide the digital-asset service you request",
      "Legal obligation where financial, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Digital-Asset Services",
    serviceTermsBody: "Digital-asset features are provided subject to the applicable eligibility requirements, asset information, limits, review requirements, and risk notices shown through the service.",
    serviceTermsItems: [
      "You are responsible for reviewing transaction details and providing accurate wallet or trading instructions",
      "Deposits, withdrawals, orders, or trades may be reviewed, delayed, limited, rejected, or cancelled for security, compliance, network, or operational reasons",
      "Digital assets can be volatile and carry risk; displayed prices or estimates do not guarantee a result",
    ],
    retention: "We retain account, identity, wallet, trading, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal and financial recordkeeping obligations.",
    eligibility: "You must meet the legal and service eligibility requirements shown during registration and before using digital-asset features.",
    childrenPrivacy: "Digital-asset services are not directed to children under 18.",
    hasFinancialRecords: true,
  },
  loan: {
    serviceName: "loan services",
    introduction: "This policy explains how information is handled when you use loan products, applications, documents, repayment features, and support services provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, date of birth, email address, phone number, and address",
      "Loan applications, eligibility information, supporting documents, repayment schedules, and payment history",
      "Identity verification and KYC/AML information required for loan services",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Review and administer loan applications, products, documents, approvals, and repayments",
      "Process payments, confirmations, notices, and account or application requests",
      "Verify identity, assess eligibility, prevent fraud, secure accounts, and meet applicable legal obligations",
      "Provide support and updates about your application, loan, or repayment activity",
    ],
    legalBases: [
      "Contractual necessity to assess or provide the loan service you request",
      "Legal obligation where financial, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Loan Services",
    serviceTermsBody: "Loan applications and services are subject to the eligibility, documentation, approval, repayment, fee, and disclosure terms shown for the relevant product.",
    serviceTermsItems: [
      "You are responsible for providing complete and accurate application and repayment information",
      "Applications and requests may be reviewed, delayed, limited, declined, or held for verification",
      "An application or estimate is not a promise that a loan will be approved or funded",
    ],
    retention: "We retain application, identity, document, repayment, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal and financial recordkeeping obligations.",
    eligibility: "You must meet the legal and product eligibility requirements shown during registration and application.",
    childrenPrivacy: "Loan services are not directed to children under 18.",
    hasFinancialRecords: true,
  },
  digital_wallet: {
    serviceName: "digital wallet and payment services",
    introduction: "This policy explains how information is handled when you use wallet, balance, payment, transfer, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, email address, phone number, and address",
      "Wallet, balance, payment, transfer, deposit, withdrawal, and transaction information",
      "Identity verification information when enabled or required for a service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Create and administer your wallet and provide requested payment features",
      "Process payments, transfers, deposits, withdrawals, confirmations, and account notices",
      "Verify identity when required, prevent fraud, and secure accounts",
      "Provide support, service updates, and records needed to administer your account",
    ],
    legalBases: [
      "Contractual necessity to provide the wallet or payment service you request",
      "Legal obligation where identity, payment, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Wallet & Payment Services",
    serviceTermsBody: "Wallet and payment features are subject to the applicable eligibility, payment, fee, limit, review, and availability information shown through the service.",
    serviceTermsItems: [
      "You are responsible for providing accurate payment and transfer information",
      "Payments or transfers may be reviewed, delayed, limited, rejected, or reversed for security, compliance, or error correction",
      "Keep account credentials and security information confidential and report unauthorized activity promptly",
    ],
    retention: "We retain account, identity where applicable, wallet, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet the legal and service eligibility requirements shown during registration and before using wallet or payment features.",
    childrenPrivacy: "Wallet and payment services are not directed to children under 18.",
    hasFinancialRecords: true,
  },
  insurance: {
    serviceName: "insurance services",
    introduction: "This policy explains how information is handled when you use insurance products, policies, premiums, claims, documents, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, email address, phone number, and address",
      "Policy, premium, application, claim, incident, beneficiary, and supporting document information",
      "Identity verification information when enabled or required for a service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Provide and administer insurance products, applications, policies, premiums, and claims",
      "Process payments, documents, notices, and service requests",
      "Verify information when required, prevent fraud, and secure accounts",
      "Provide support and updates about your policy or claim",
    ],
    legalBases: [
      "Contractual necessity to provide the insurance service you request",
      "Legal obligation where insurance, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Insurance Services",
    serviceTermsBody: "Insurance products, policies, premiums, and claims are subject to the product disclosures, eligibility, coverage, exclusions, documentation, and review terms shown for the relevant service.",
    serviceTermsItems: [
      "You are responsible for providing accurate application, policy, premium, and claim information",
      "Applications and claims may be reviewed, delayed, limited, or declined under the applicable product terms",
      "Information displayed on this website does not replace the policy or other applicable product documents",
    ],
    retention: "We retain policy, identity where applicable, claim, payment, and supporting records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet the legal and product eligibility requirements shown during registration and before using an insurance feature.",
    childrenPrivacy: "Insurance services are not directed to children under 18 unless a specific product expressly provides otherwise.",
    hasFinancialRecords: false,
  },
  crowdfunding: {
    serviceName: "crowdfunding services",
    introduction: "This policy explains how information is handled when you use campaigns, contributions, creator updates, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, email address, phone number, and address",
      "Campaign, contribution, payment, creator, and update information",
      "Identity verification information when enabled or required for a creator or contribution service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Publish or support campaigns and provide contribution and update features",
      "Process contributions, confirmations, notices, and service requests",
      "Verify information when required, prevent fraud, and secure accounts",
      "Provide support and updates about campaigns or contributions",
    ],
    legalBases: [
      "Contractual necessity to provide the crowdfunding service you request",
      "Legal obligation where payment, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Crowdfunding Services",
    serviceTermsBody: "Campaigns and contributions are subject to the campaign information, eligibility, payment, review, refund, and risk notices shown through the service.",
    serviceTermsItems: [
      "Creators and contributors are responsible for providing accurate information",
      "Campaigns or contributions may be reviewed, delayed, limited, rejected, or refunded for security, compliance, or operational reasons",
      "A campaign or contribution does not guarantee a particular outcome or return",
    ],
    retention: "We retain account, campaign, contribution, payment, and identity records where applicable for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet the legal and service eligibility requirements shown during registration and before creating or supporting a campaign.",
    childrenPrivacy: "Crowdfunding services are not directed to children under 18 unless a specific service expressly provides otherwise.",
    hasFinancialRecords: false,
  },
  microfinance: {
    serviceName: "microfinance services",
    introduction: "This policy explains how information is handled when you use microfinance products, savings, loans, repayments, payments, and support features provided through this website.",
    collectedInformation: [
      "Identity and contact information, including your name, date of birth, email address, phone number, and address",
      "Financial product, savings, loan, repayment, payment, deposit, and account activity information",
      "Identity verification and KYC/AML information required for microfinance services",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Provide and administer microfinance products, savings, loans, repayments, deposits, and payments",
      "Process payments, confirmations, notices, and service requests",
      "Verify identity, prevent fraud, secure accounts, and meet applicable legal obligations",
      "Provide support, service updates, and records needed to administer your account",
    ],
    legalBases: [
      "Contractual necessity to provide the microfinance service you request",
      "Legal obligation where financial, identity, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure service and preventing misuse",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Microfinance Services",
    serviceTermsBody: "Microfinance products and transactions are subject to the applicable eligibility, repayment, payment, fee, limit, review, and disclosure terms shown for the relevant service.",
    serviceTermsItems: [
      "You are responsible for providing accurate application, account, payment, and repayment information",
      "Requests may be reviewed, delayed, limited, declined, or held for verification",
      "Displayed estimates or eligibility information do not guarantee approval or funding",
    ],
    retention: "We retain account, identity, product, repayment, and transaction records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal and financial recordkeeping obligations.",
    eligibility: "You must meet the legal and product eligibility requirements shown during registration and before using a microfinance feature.",
    childrenPrivacy: "Microfinance services are not directed to children under 18.",
    hasFinancialRecords: true,
  },
  ecommerce: {
    serviceName: "online shopping services",
    introduction: "This policy explains how information is handled when you browse products or use orders, payments, shipping, returns, and support features provided through this website.",
    collectedInformation: [
      "Name and contact information needed for an account, order, delivery, or support request",
      "Product, cart, order, payment, shipping, return, and refund information",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Display products and process orders, payments, delivery, returns, refunds, and support requests",
      "Send order confirmations, delivery updates, and service notices",
      "Prevent fraud, secure accounts and payments, and improve the shopping experience",
    ],
    legalBases: [
      "Contractual necessity to process the order or service you request",
      "Legal obligation for tax, consumer, payment, or fraud-prevention requirements",
      "Legitimate interests in operating a secure and reliable shopping service",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Orders & Shopping Services",
    serviceTermsBody: "Products, orders, payments, shipping, returns, and refunds are subject to the product information and order terms shown before you complete a purchase.",
    serviceTermsItems: [
      "You are responsible for providing accurate order, payment, and delivery information",
      "Orders may be reviewed, delayed, cancelled, or refunded for stock, payment, security, or operational reasons",
      "Delivery dates and product availability may change, and product information may be updated",
    ],
    retention: "We retain account, order, payment, delivery, return, and support records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must be legally able to enter into a purchase and meet any age or product requirements shown at checkout.",
    childrenPrivacy: "The shopping service is not directed to children under 13, and some products may have additional age requirements.",
    hasFinancialRecords: false,
  },
  real_estate: {
    serviceName: "real-estate services",
    introduction: "This policy explains how information is handled when you use property listings, inquiries, applications, appointments, documents, and support features provided through this website.",
    collectedInformation: [
      "Name and contact information provided for an account, inquiry, appointment, or support request",
      "Property preferences, listing inquiries, applications, appointment details, and documents you choose to provide",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Display properties and respond to inquiries, applications, appointments, and document requests",
      "Send service notices and coordinate communications about properties or appointments",
      "Prevent fraud, secure accounts, and improve the property experience",
    ],
    legalBases: [
      "Contractual necessity to provide the property service or response you request",
      "Legal obligation where housing, consumer, or fraud-prevention rules apply",
      "Legitimate interests in operating a secure and reliable property service",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Property Services",
    serviceTermsBody: "Listings, availability, pricing, applications, appointments, and property information are subject to the applicable listing and service details shown through the website.",
    serviceTermsItems: [
      "You are responsible for providing accurate inquiry, application, and appointment information",
      "Listings, availability, pricing, and appointment times may change or require confirmation",
      "Information on the website is not a guarantee that a property will remain available or that an application will be approved",
    ],
    retention: "We retain inquiry, application, appointment, document, and support records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet any legal, property, application, and appointment requirements shown for the service you use.",
    childrenPrivacy: "Real-estate services are not directed to children under 18.",
    hasFinancialRecords: false,
  },
  airline: {
    serviceName: "flight booking services",
    introduction: "This policy explains how information is handled when you use flight search, passenger, booking, ticket, schedule, cancellation, and support features provided through this website.",
    collectedInformation: [
      "Passenger and contact information needed for a booking, ticket, travel notice, or support request",
      "Flight search, booking, ticket, schedule, cancellation, and travel preference information",
      "Payment information when you choose a paid booking or service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Search and administer flights, passengers, bookings, tickets, schedules, and cancellations",
      "Process payments, confirmations, travel notices, and support requests",
      "Prevent fraud, secure accounts and bookings, and provide service updates",
    ],
    legalBases: [
      "Contractual necessity to provide the booking or travel service you request",
      "Legal obligation for travel, payment, consumer, or fraud-prevention requirements",
      "Legitimate interests in operating a secure and reliable booking service",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Flight Bookings",
    serviceTermsBody: "Flights, bookings, tickets, schedules, fees, cancellations, and travel requirements are subject to the applicable booking information and carrier or service terms shown before you proceed.",
    serviceTermsItems: [
      "You are responsible for providing accurate passenger and travel information",
      "Schedules, availability, prices, bookings, or tickets may change, be reviewed, or be cancelled under the applicable terms",
      "Travel documentation and entry requirements remain the passenger's responsibility",
    ],
    retention: "We retain passenger, booking, ticket, payment, cancellation, and support records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet the travel, passenger, age, and documentation requirements shown for the booking or service you use.",
    childrenPrivacy: "A parent or guardian may need to provide information or consent for a minor passenger where required by the applicable service.",
    hasFinancialRecords: false,
  },
  logistics: {
    serviceName: "logistics and delivery services",
    introduction: "This policy explains how information is handled when you use shipment, pickup, delivery, carrier, address, tracking, and support features provided through this website.",
    collectedInformation: [
      "Name and contact information needed for a shipment, pickup, delivery, or support request",
      "Shipment, package, pickup, delivery, carrier, address, recipient, and tracking information",
      "Payment information when you choose a paid logistics service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Create and coordinate shipments, pickups, deliveries, carriers, addresses, and tracking updates",
      "Process payments, confirmations, delivery notices, and support requests",
      "Prevent fraud, secure accounts and shipment information, and improve logistics operations",
    ],
    legalBases: [
      "Contractual necessity to provide the shipment or delivery service you request",
      "Legal obligation for transport, payment, consumer, or fraud-prevention requirements",
      "Legitimate interests in operating a secure and reliable logistics service",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Shipments & Delivery",
    serviceTermsBody: "Shipment records, tracking events, pickup and delivery estimates, and carrier information are provided for the logistics service requested and may change as the shipment moves.",
    serviceTermsItems: [
      "You are responsible for providing accurate sender, recipient, address, and shipment information",
      "Pickup, delivery, tracking events, and estimated dates may change because of carrier, customs, weather, address, or operational conditions",
      "Do not use shipment or tracking information to access records you are not authorized to view",
    ],
    retention: "We retain shipment, address, tracking, payment where applicable, and support records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must provide the information and meet any sender, recipient, address, and service requirements shown for the shipment you create or track.",
    childrenPrivacy: "Logistics services are not directed to children under 13, and a parent or guardian may need to arrange a shipment for a minor.",
    hasFinancialRecords: false,
  },
  hospital: {
    serviceName: "healthcare appointment services",
    introduction: "This policy explains how information is handled when you use provider, department, service, appointment, patient, and support features provided through this website.",
    collectedInformation: [
      "Name and contact information needed for an account, appointment, or support request",
      "Appointment, provider, department, service, patient, and information you choose to submit through a request",
      "Payment information when you choose a paid service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Display services and coordinate providers, departments, appointments, and support requests",
      "Send appointment confirmations, reminders, service notices, and payment information where applicable",
      "Protect account and appointment information, prevent misuse, and improve the service",
    ],
    legalBases: [
      "Contractual necessity to provide the appointment or service you request",
      "Legal obligation where healthcare, consumer, payment, or security rules apply",
      "Legitimate interests in operating a secure and reliable appointment service",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Appointments & Healthcare Services",
    serviceTermsBody: "Appointment availability, provider information, service descriptions, fees, and notices are subject to the applicable healthcare provider and service terms.",
    serviceTermsItems: [
      "You are responsible for providing accurate appointment and contact information",
      "An appointment request is not confirmed until the website or provider confirms it",
      "This website does not replace professional medical advice or emergency services",
    ],
    retention: "We retain appointment, service, payment where applicable, and support records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet the appointment, patient, age, consent, and service requirements shown for the healthcare service you use.",
    childrenPrivacy: "A parent, guardian, or authorized adult may need to arrange an appointment or provide information for a minor patient.",
    hasFinancialRecords: false,
  },
  school: {
    serviceName: "education and enrollment services",
    introduction: "This policy explains how information is handled when you use student, guardian, class, course, enrollment, fee, and support features provided through this website.",
    collectedInformation: [
      "Student, guardian, or account-holder name and contact information needed for enrollment or support",
      "Class, course, enrollment, schedule, academic, fee, and document information you choose to provide",
      "Payment information when you choose a paid course or fee service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Provide courses, classes, schedules, enrollment, student or guardian support, and announcements",
      "Process fees, confirmations, notices, and service requests where applicable",
      "Protect student and account information, prevent misuse, and improve education services",
    ],
    legalBases: [
      "Contractual necessity to provide the education or enrollment service requested",
      "Legal obligation where education, child-safety, payment, or security rules apply",
      "Legitimate interests in operating a secure and reliable education service",
      "Consent or guardian authorization where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Education & Enrollment",
    serviceTermsBody: "Courses, classes, enrollment, schedules, fees, and academic information are subject to the applicable school or service details shown through the website.",
    serviceTermsItems: [
      "A student or guardian is responsible for providing accurate enrollment and contact information",
      "Enrollment, schedules, course availability, and fees may change and may require confirmation",
      "Use student and class information only for authorized education purposes",
    ],
    retention: "We retain enrollment, class, course, fee where applicable, document, and support records for as long as needed to provide services, resolve disputes, protect students, and meet applicable legal obligations.",
    eligibility: "A student, guardian, or authorized account holder must meet the enrollment, age, consent, and course requirements shown for the education service.",
    childrenPrivacy: "Education services may involve minors. We collect and use student information only for the education, enrollment, safety, and support purposes described here, with guardian or school authorization where required.",
    hasFinancialRecords: false,
  },
  hotel: {
    serviceName: "hotel reservation services",
    introduction: "This policy explains how information is handled when you use room search, availability, reservation, guest, check-in, check-out, and support features provided through this website.",
    collectedInformation: [
      "Guest and contact information needed for a reservation, check-in, or support request",
      "Room, availability, reservation, guest, stay, preference, and cancellation information",
      "Payment information when you choose a paid reservation or service",
      "Usage, device, security, and support information generated when you use the website",
    ],
    usePurposes: [
      "Search and administer rooms, availability, reservations, guest details, check-in, and check-out",
      "Process payments, confirmations, notices, cancellations, and support requests",
      "Prevent fraud, secure accounts and reservations, and provide service updates",
    ],
    legalBases: [
      "Contractual necessity to provide the reservation or hospitality service you request",
      "Legal obligation for accommodation, payment, consumer, or fraud-prevention requirements",
      "Legitimate interests in operating a secure and reliable reservation service",
      "Consent where a particular processing activity requires it",
    ],
    serviceTermsTitle: "Reservations & Stays",
    serviceTermsBody: "Room availability, rates, reservations, check-in, check-out, fees, and cancellation terms are subject to the applicable reservation information shown before you proceed.",
    serviceTermsItems: [
      "You are responsible for providing accurate guest, contact, and reservation information",
      "Availability, rates, reservation status, and check-in requirements may change or require confirmation",
      "Guests must follow the applicable property rules and check-in requirements",
    ],
    retention: "We retain guest, reservation, payment, cancellation, and support records for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
    eligibility: "You must meet the guest, age, identity, payment, and property requirements shown for the reservation or service you use.",
    childrenPrivacy: "A parent or guardian may need to make a reservation or provide information for a minor guest.",
    hasFinancialRecords: false,
  },
};

const DEFAULT_PROFILE: Omit<PublicLegalProfile, "hasKyc" | "hasAccounts" | "hasPayment"> = {
  serviceName: "website services",
  introduction: "This policy explains how information is handled when you use the services and support features provided through this website.",
  collectedInformation: [
    "Name and contact information that you provide for an account, service request, or support request",
    "Information needed to provide the particular service you choose",
    "Usage, device, security, and support information generated when you use the website",
  ],
  usePurposes: [
    "Provide and administer the services you request",
    "Respond to support requests and send service or security notices",
    "Protect the website, prevent misuse, and improve the service",
  ],
  legalBases: [
    "Contractual necessity to provide the service you request",
    "Legal obligation where applicable",
    "Legitimate interests in operating a secure and reliable service",
    "Consent where a particular processing activity requires it",
  ],
  serviceTermsTitle: "Website Services",
  serviceTermsBody: "Services, availability, eligibility, fees, and other requirements are described on the relevant pages before you proceed.",
  serviceTermsItems: [
    "Provide accurate information when using the service",
    "Use the website lawfully and only for authorized purposes",
    "Follow the notices and service terms shown for the feature you use",
  ],
  retention: "We retain information for as long as needed to provide services, resolve disputes, protect customers, and meet applicable legal obligations.",
  eligibility: "You must meet the eligibility requirements shown for the service you use.",
  childrenPrivacy: "The website is not directed to children under 13 unless a specific service expressly provides otherwise.",
  hasFinancialRecords: false,
};

export function getPublicLegalProfile(site: PublicLegalSite | null | undefined): PublicLegalProfile {
  const type = site?.type ?? "unknown";
  const profile = PROFILES[type] ?? DEFAULT_PROFILE;
  const capabilities = site?.capabilities;

  return {
    ...profile,
    hasKyc: Boolean(capabilities?.kyc?.enabled && capabilities.kycSupported !== false),
    hasAccounts: Boolean(capabilities?.customerAccounts),
    hasPayment: Boolean(capabilities?.payment),
  };
}