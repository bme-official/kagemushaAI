import { createClient } from "@supabase/supabase-js";

export const createSupabaseServerClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service);
};
