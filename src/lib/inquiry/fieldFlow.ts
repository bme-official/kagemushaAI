import { inquiryConfig } from "@/config/inquiry.config";
import type { CollectedContactFields, StructuredFieldRequest } from "@/types/chat";

export const getNextFieldRequest = (
  collected: CollectedContactFields
): StructuredFieldRequest | null => {
  for (const field of inquiryConfig.fieldCollection) {
    const value = collected[field.fieldName];
    if (field.required && !value) {
      return {
        kind: "field_request",
        fieldName: field.fieldName,
        inputType: field.inputType,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder
      };
    }
  }

  for (const field of inquiryConfig.fieldCollection) {
    const value = collected[field.fieldName];
    if (!value) {
      return {
        kind: "field_request",
        fieldName: field.fieldName,
        inputType: field.inputType,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder
      };
    }
  }
  return null;
};
