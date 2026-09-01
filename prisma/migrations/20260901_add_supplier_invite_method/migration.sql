-- AddColumn `inviteMethod` to `supplier_invites`
ALTER TABLE "supplier_invites" ADD COLUMN "invite_method" TEXT NOT NULL DEFAULT 'magic-link';
