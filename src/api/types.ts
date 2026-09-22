export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant: Tenant;
}

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  profileName: string | null;
  email?: string | null;
  tags?: string | null;
  createdAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  messageType: string;
  textContent: string | null;
  status: string;
  messageTimestamp: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  status: string;
  lastMessageAt: string | null;
  contact: Contact;
  whatsappAccount?: { id: string; businessName: string | null; displayPhoneNumber: string | null } | null;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  componentsJson: string | null;
}

export interface CampaignCounts {
  PENDING: number;
  SENT: number;
  FAILED: number;
  CANCELLED: number;
  total: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  template: { id: string; name: string; language: string } | null;
  counts: CampaignCounts;
}

export interface CampaignRecipient {
  id: string;
  status: string;
  errorMessage: string | null;
  contact: Contact;
  message: {
    id: string;
    status: string;
    whatsappMessageId: string | null;
    messageTimestamp: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  } | null;
}

export interface CampaignDetail extends Campaign {
  template: MessageTemplate | null;
  parametersJson: string | null;
  recipients: CampaignRecipient[];
}

export interface WhatsappAccount {
  id: string;
  businessName: string | null;
  displayPhoneNumber: string | null;
  wabaId: string;
  phoneNumberId: string;
  status: string;
  createdAt: string;
}

export interface DashboardSummary {
  messagesToday: number;
  deliveredToday: number;
  openConversations: number;
  totalCampaigns: number;
  whatsapp: (WhatsappAccount & { connected: boolean }) | null;
}
