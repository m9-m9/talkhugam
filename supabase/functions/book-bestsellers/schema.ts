import { z } from "npm:zod@4.4.3";

export const aladinBestsellerResponseSchema = z.object({
  item: z.array(z.object({
    author: z.string().default(""),
    cover: z.string().url().nullable().optional(),
    isbn13: z.string().trim().min(1).nullable().optional(),
    link: z.string().url().nullable().optional(),
    publisher: z.string().default(""),
    title: z.string().trim().min(1),
  })).default([]),
});

export type AladinBestseller = {
  authors: string[];
  externalUrl: string | null;
  id: string;
  publisher: string | null;
  thumbnailUrl: string | null;
  title: string;
};

export type BookBestsellerResult = {
  isConfigured: boolean;
  items: AladinBestseller[];
};
