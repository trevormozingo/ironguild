// ──────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT
// Source: models/profile/*.schema.json
// Regenerate: npm run generate:models
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

export type FieldMeta = {
  name: string;
  label: string;
  placeholder: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  nullable: boolean;
  keyboard: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secure: boolean;
  multiline: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
  /** When set to 'date', renders a native date-picker instead of a text input */
  inputType?: 'text' | 'date';
};


/** Base profile schema containing all profile fields */
export const BaseProfileSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).nullable().default(null).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null).optional(),
});
export type BaseProfile = z.infer<typeof BaseProfileSchema>;

/** Schema for creating a new profile. Server generates id, timestamps, and defaults. */
export const CreateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(100).optional(),
});
export type CreateProfile = z.infer<typeof CreateProfileSchema>;

export const CreateProfileFields: FieldMeta[] = [
  {
    name: "username",
    label: "Username",
    placeholder: "Enter username",
    type: "string",
    required: true,
    nullable: false,
    keyboard: "default",
    secure: false,
    multiline: false,
    minLength: 3,
    maxLength: 30,
    pattern: "^[a-zA-Z0-9_-]+$",
    description: "Unique username (alphanumeric, underscores, hyphens)",
  },
  {
    name: "displayName",
    label: "Display Name",
    placeholder: "Enter display name",
    type: "string",
    required: false,
    nullable: false,
    keyboard: "default",
    secure: false,
    multiline: false,
    minLength: 1,
    maxLength: 100,
    description: "User's display name",
  }
];

/** Schema for updating an existing profile. All fields are optional — only provided fields are updated. */
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).nullable().default(null).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null).optional(),
}).refine(
  (data) => Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined).length >= 1,
  { message: 'At least 1 field(s) must be provided' }
);
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const UpdateProfileFields: FieldMeta[] = [
  {
    name: "displayName",
    label: "Display Name",
    placeholder: "Enter display name",
    type: "string",
    required: false,
    nullable: false,
    keyboard: "default",
    secure: false,
    multiline: false,
    minLength: 1,
    maxLength: 100,
    description: "User's display name",
  },
  {
    name: "bio",
    label: "Bio",
    placeholder: "Enter bio",
    type: "string",
    required: false,
    nullable: true,
    keyboard: "default",
    secure: false,
    multiline: true,
    maxLength: 500,
    description: "Short biography",
  },
  {
    name: "birthday",
    label: "Birthday",
    placeholder: "Select your birthday",
    type: "string",
    required: false,
    nullable: true,
    keyboard: "default",
    secure: false,
    multiline: false,
    description: "User's date of birth",
    inputType: "date",
  }
];

/** Public-facing profile view. Excludes sensitive fields. */
export const PublicProfileSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).nullable().default(null).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null).optional(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/** Full profile view for the authenticated owner. Includes all fields. */
export const PrivateProfileSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).nullable().default(null).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null).optional(),
});
export type PrivateProfile = z.infer<typeof PrivateProfileSchema>;
