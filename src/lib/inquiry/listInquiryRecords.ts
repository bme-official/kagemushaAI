import { listInquiriesFromMemory } from "@/lib/inquiry/inMemoryStore";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InquiryRecord } from "@/types/inquiry";

export const listInquiryRecords = async (): Promise<InquiryRecord[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return listInquiriesFromMemory();

  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(50);

  if (error || !data) {
    return listInquiriesFromMemory();
  }

  return data.map((row) => ({
    ...row,
    rawMessages:
      typeof row.rawMessages === "string"
        ? JSON.parse(row.rawMessages)
        : row.rawMessages
  })) as InquiryRecord[];
};
