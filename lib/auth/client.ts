"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export type { Session } from "@/lib/auth";
