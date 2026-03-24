import { NextRequest, NextResponse } from "next/server";
import { createInquiryRecord } from "@/lib/inquiry/createInquiryRecord";
import { listInquiryRecords } from "@/lib/inquiry/listInquiryRecords";
import { mapConversationToInquiry } from "@/lib/inquiry/mapConversationToInquiry";
import { notifyInquiry } from "@/lib/inquiry/notifyInquiry";
import { summarizeInquiry } from "@/lib/ai/summarizeInquiry";
import type { ChatSessionState } from "@/types/chat";

const canAccessAdminGet = (request: NextRequest): boolean => {
  if (process.env.NODE_ENV !== "production") return true;
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return false;
  return request.headers.get("x-admin-token") === token;
};

export async function GET(request: NextRequest) {
  if (!canAccessAdminGet(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const inquiries = await listInquiryRecords();
  return NextResponse.json({ inquiries });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { session: ChatSessionState };
  const session = body.session;
  const summary = summarizeInquiry(session);
  const inquiry = mapConversationToInquiry(session, summary);

  const saved = await createInquiryRecord(inquiry);
  await notifyInquiry({
    inquiry: saved,
    collectedFields: session.collectedFields,
    botMemo: `urgency=${saved.urgency}, needsHuman=${saved.needsHuman}`
  });

  return NextResponse.json({ ok: true, inquiryId: saved.id });
}
