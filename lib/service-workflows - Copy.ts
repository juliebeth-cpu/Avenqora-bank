export type WorkflowFieldType = "text" | "textarea" | "number" | "date" | "select";

export interface ServiceWorkflowField {
  key: string;
  label: string;
  type: WorkflowFieldType;
  required?: boolean;
  options?: string[];
}

export interface ServiceWorkflowDefinition {
  type: string;
  label: string;
  description: string;
  steps: string[];
  fields: ServiceWorkflowField[];
  amountKey?: string;
}

const f = (key: string, label: string, type: WorkflowFieldType = "text", required = true, options?: string[]): ServiceWorkflowField =>
  ({ key, label, type, required, options });
const w = (type: string, label: string, description: string, steps: string[], fields: ServiceWorkflowField[], amountKey?: string): ServiceWorkflowDefinition =>
  ({ type, label, description, steps, fields, amountKey });

export const SERVICE_WORKFLOWS: Record<string, ServiceWorkflowDefinition> = {
  digital_wallet: w("digital_wallet", "Wallet transfer", "Send, receive, deposit, or withdraw from your service wallet.", ["Choose an action", "Enter transfer details", "Submit for review"], [
    f("action", "Action", "select", true, ["send", "receive", "deposit", "withdrawal"]), f("recipient", "Recipient or wallet address"), f("amount", "Amount", "number"), f("note", "Note", "textarea", false),
  ], "amount"),
  loan: w("loan", "Loan application", "Submit a structured loan request for approval and repayment planning.", ["Choose a product", "Provide application details", "Submit for review"], [
    f("product", "Loan product"), f("requestedAmount", "Requested amount", "number"), f("termMonths", "Term in months", "number"), f("purpose", "Purpose", "textarea"), f("employment", "Employment or income source"), f("documentReference", "Document reference", "text", false),
  ], "requestedAmount"),
  ecommerce: w("ecommerce", "Product order", "Place a structured order with delivery details and payment amount.", ["Choose a product", "Add delivery details", "Submit order for review"], [
    f("product", "Product"), f("quantity", "Quantity", "number"), f("shippingAddress", "Shipping address", "textarea"), f("deliveryOption", "Delivery option", "select", true, ["standard", "express", "pickup"]), f("amount", "Order total", "number"),
  ], "amount"),
  real_estate: w("real_estate", "Property request", "Submit an inquiry, application, or appointment for a property.", ["Choose a property", "Choose a request type", "Submit your request"], [
    f("property", "Property or listing"), f("requestType", "Request type", "select", true, ["inquiry", "application", "appointment"]), f("appointmentDate", "Preferred appointment date", "date", false), f("message", "Message", "textarea"), f("amount", "Payment amount", "number", false),
  ], "amount"),
  insurance: w("insurance", "Coverage request", "Apply for coverage or file a structured claim.", ["Choose a plan", "Provide request details", "Submit for review"], [
    f("plan", "Plan or product"), f("requestType", "Request type", "select", true, ["application", "claim"]), f("policyNumber", "Policy number", "text", false), f("incidentDate", "Incident date", "date", false), f("description", "Description", "textarea"), f("amount", "Premium or claim amount", "number", false),
  ], "amount"),
  airline: w("airline", "Flight booking", "Request a flight booking with passenger and itinerary details.", ["Choose an itinerary", "Add passenger information", "Submit booking for review"], [
    f("origin", "Origin"), f("destination", "Destination"), f("travelDate", "Travel date", "date"), f("passengerName", "Passenger name"), f("passengers", "Number of passengers", "number"), f("cabin", "Cabin", "select", true, ["economy", "premium_economy", "business", "first"]), f("amount", "Ticket total", "number"),
  ], "amount"),
  logistics: w("logistics", "Freight order", "Create a pickup and delivery request with carrier-ready shipment details.", ["Enter pickup and delivery", "Describe the shipment", "Submit for tracking"], [
    f("pickupAddress", "Pickup address", "textarea"), f("deliveryAddress", "Delivery address", "textarea"), f("packageDescription", "Package description", "textarea"), f("carrier", "Preferred carrier", "text", false), f("pickupDate", "Pickup date", "date"), f("amount", "Shipping amount", "number"),
  ], "amount"),
  hospital: w("hospital", "Appointment request", "Book a structured appointment for a department or service.", ["Choose a service", "Provide patient and appointment details", "Submit appointment request"], [
    f("patientName", "Patient name"), f("department", "Department"), f("service", "Service"), f("provider", "Preferred provider", "text", false), f("appointmentDate", "Appointment date", "date"), f("reason", "Reason for visit", "textarea"), f("amount", "Billing amount", "number", false),
  ], "amount"),
  school: w("school", "Course enrollment", "Submit a student enrollment request with guardian and course details.", ["Enter student information", "Choose a course", "Submit enrollment"], [
    f("studentName", "Student name"), f("guardianName", "Guardian name", "text", false), f("course", "Course or class"), f("term", "Term"), f("enrollmentType", "Enrollment type", "select", true, ["new", "returning", "transfer"]), f("amount", "Fees", "number"),
  ], "amount"),
  hotel: w("hotel", "Room reservation", "Request a room reservation with guest and stay details.", ["Choose a room", "Enter guest and stay details", "Submit reservation"], [
    f("roomType", "Room type"), f("checkIn", "Check-in date", "date"), f("checkOut", "Check-out date", "date"), f("guestName", "Guest name"), f("guests", "Number of guests", "number"), f("amount", "Reservation total", "number"),
  ], "amount"),
  crowdfunding: w("crowdfunding", "Campaign contribution", "Back a campaign and record your contribution details.", ["Choose a campaign", "Enter contribution details", "Submit contribution for review"], [
    f("campaign", "Campaign"), f("contributionAmount", "Contribution amount", "number"), f("message", "Message to the creator", "textarea", false), f("anonymous", "Display anonymously", "select", true, ["yes", "no"]),
  ], "contributionAmount"),
  microfinance: w("microfinance", "Microfinance request", "Apply for a micro-loan or savings product with a repayment plan.", ["Choose a financial product", "Provide request details", "Submit for approval"], [
    f("productType", "Product type", "select", true, ["loan", "savings"]), f("product", "Financial product"), f("requestedAmount", "Requested amount", "number"), f("termMonths", "Term in months", "number", false), f("purpose", "Purpose", "textarea"),
  ], "requestedAmount"),
};

export function getServiceWorkflow(type?: string | null): ServiceWorkflowDefinition | null {
  return type ? SERVICE_WORKFLOWS[type] ?? null : null;
}

export function workflowFieldLabel(definition: ServiceWorkflowDefinition, key: string): string {
  return definition.fields.find((field) => field.key === key)?.label ?? key;
}