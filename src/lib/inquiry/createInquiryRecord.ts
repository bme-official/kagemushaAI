import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveInquiryToMemory } from "@/lib/inquiry/inMemoryStore";
import type { InquiryRecord } from "@/types/inquiry";

export const createInquiryRecord = async (inquiry: InquiryRecord) => {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return saveInquiryToMemory(inquiry);
  }

  const { error } = await supabase.from("inquiries").insert({
    ...inquiry,
    rawMessages: JSON.stringify(inquiry.rawMessages)
  });

  if (error) {
    // TODO: 将来は監視基盤へ送る
    console.error("[inquiry] failed to save supabase, fallback memory", error);
    return saveInquiryToMemory(inquiry);
  }

  return inquiry;
};
