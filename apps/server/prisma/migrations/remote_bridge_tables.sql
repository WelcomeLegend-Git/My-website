-- CreateTable: RemoteBridgeDevice
CREATE TABLE IF NOT EXISTS "RemoteBridgeDevice" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'phone', -- 'phone' or 'tablet'
    "deviceName" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3),
    "encryptionKey" TEXT, -- Base64 encoded E2E key
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemoteBridgeDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "RemoteBridgeDevice_userId_deviceId_key" UNIQUE ("userId", "deviceId")
);

-- CreateTable: RemoteBridgeSession
CREATE TABLE IF NOT EXISTS "RemoteBridgeSession" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemoteBridgeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CreateTable: RemoteBridgeActivityLog
CREATE TABLE IF NOT EXISTS "RemoteBridgeActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "action" TEXT NOT NULL, -- 'login', 'command', 'device_added', 'device_removed', 'kill_switch', etc.
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemoteBridgeActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CreateTable: RemoteBridgeLoginAttempt (rate limiting)
CREATE TABLE IF NOT EXISTS "RemoteBridgeLoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "ipAddress" TEXT NOT NULL,
    "email" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS "RemoteBridgeDevice_userId_idx" ON "RemoteBridgeDevice"("userId");
CREATE INDEX IF NOT EXISTS "RemoteBridgeSession_userId_idx" ON "RemoteBridgeSession"("userId");
CREATE INDEX IF NOT EXISTS "RemoteBridgeSession_token_idx" ON "RemoteBridgeSession"("token");
CREATE INDEX IF NOT EXISTS "RemoteBridgeActivityLog_userId_idx" ON "RemoteBridgeActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "RemoteBridgeActivityLog_createdAt_idx" ON "RemoteBridgeActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "RemoteBridgeLoginAttempt_ipAddress_idx" ON "RemoteBridgeLoginAttempt"("ipAddress");
CREATE INDEX IF NOT EXISTS "RemoteBridgeLoginAttempt_createdAt_idx" ON "RemoteBridgeLoginAttempt"("createdAt");
