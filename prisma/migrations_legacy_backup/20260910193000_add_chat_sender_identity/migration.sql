ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "SupportMessage" ADD COLUMN "senderId" TEXT;
CREATE INDEX "SupportMessage_senderId_createdAt_idx" ON "SupportMessage"("senderId", "createdAt");
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
