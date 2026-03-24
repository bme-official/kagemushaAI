import type { InquiryRecord } from "@/types/inquiry";

const inquiryStore: InquiryRecord[] = [];

export const saveInquiryToMemory = (inquiry: InquiryRecord) => {
  inquiryStore.unshift(inquiry);
  return inquiry;
};

export const listInquiriesFromMemory = () => {
  return inquiryStore;
};
