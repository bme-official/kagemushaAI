export type ChatRole = "user" | "assistant" | "system";

export type ChatMessageKind = "text" | "field_request" | "summary";

export type StructuredInputType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "confirm";

export type StructuredFieldRequest = {
  kind: "field_request";
  fieldName: keyof CollectedContactFields | "confirmSubmit";
  inputType: StructuredInputType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  message?: string;
};

export type ConversationMessage = {
  id: string;
  role: ChatRole;
  kind: ChatMessageKind;
  content: string;
  createdAt: string;
  fieldRequest?: StructuredFieldRequest;
};

export type CollectedContactFields = {
  organization?: string;
  name?: string;
  email?: string;
  phone?: string;
  inquiryBody?: string;
  budget?: string;
  deadline?: string;
};

export type ChatSessionPhase = "collecting" | "confirming" | "completed";

export type ChatSessionState = {
  sessionId: string;
  sourcePage: string;
  phase: ChatSessionPhase;
  inferredCategory: string | null;
  inferredIntent: string | null;
  urgency: "low" | "medium" | "high";
  needsHuman: boolean;
  summaryDraft: string;
  messages: ConversationMessage[];
  collectedFields: CollectedContactFields;
};

export type ChatApiRequest = {
  session: ChatSessionState;
  inputMode?: "voice" | "text";
  avatarSettings?: {
    modelUrl?: string;
    avatarName?: string;
    avatarNameKana?: string;
    avatarAge?: string;
    companyName?: string;
    companyNameKana?: string;
    profile?: string;
    statuses?: string[];
    statusMappings?: Record<
      string,
      {
        expressionOptionIds: string[];
        poses: Array<"neutral" | "upright" | "friendly" | "leanForward" | "confident">;
        gestureOptionIds: string[];
      }
    >;
    services?: Array<{
      name: string;
      ruby: string;
      description: string;
    }>;
    /** ウェブサイトから取得した会社・サービス情報テキスト */
    knowledgeBaseUrl?: string;
    knowledgeBaseText?: string;
    /** TTS 読み方補正リスト */
    ttsCorrections?: Array<{ term: string; reading: string }>;
  };
  userInput?: string;
  fieldResponse?: {
    fieldName: keyof CollectedContactFields | "confirmSubmit";
    value: string;
  };
};

export type ChatAgentResult = {
  reply: string;
  inferredCategory: string | null;
  inferredIntent: string | null;
  urgency: "low" | "medium" | "high";
  needsHuman: boolean;
  nextFieldRequest: StructuredFieldRequest | null;
  collectedFields: CollectedContactFields;
  summaryDraft: string;
};
