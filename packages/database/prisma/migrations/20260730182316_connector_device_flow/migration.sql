/*
  Warnings:

  - Added the required column `default_project_id` to the `connector_installations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeviceAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CONSUMED', 'EXPIRED');

-- AlterTable
ALTER TABLE "connector_installations" ADD COLUMN     "default_project_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "device_authorizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_code_hash" CHAR(64) NOT NULL,
    "user_code" VARCHAR(12) NOT NULL,
    "platform" VARCHAR(80) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "protocol_version" VARCHAR(20) NOT NULL,
    "status" "DeviceAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "tenant_id" UUID,
    "user_id" UUID,
    "project_id" UUID,
    "installation_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_polled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "device_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "installation_id" UUID NOT NULL,
    "access_token_hash" CHAR(64) NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "family_id" UUID NOT NULL,
    "access_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_authorizations_device_code_hash_key" ON "device_authorizations"("device_code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "device_authorizations_user_code_key" ON "device_authorizations"("user_code");

-- CreateIndex
CREATE INDEX "device_authorizations_status_expires_at_idx" ON "device_authorizations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "device_authorizations_tenant_id_user_id_idx" ON "device_authorizations"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "connector_credentials_access_token_hash_key" ON "connector_credentials"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "connector_credentials_refresh_token_hash_key" ON "connector_credentials"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "connector_credentials_installation_id_created_at_idx" ON "connector_credentials"("installation_id", "created_at");

-- CreateIndex
CREATE INDEX "connector_credentials_family_id_idx" ON "connector_credentials"("family_id");

-- AddForeignKey
ALTER TABLE "device_authorizations" ADD CONSTRAINT "device_authorizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_authorizations" ADD CONSTRAINT "device_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_authorizations" ADD CONSTRAINT "device_authorizations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_authorizations" ADD CONSTRAINT "device_authorizations_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "connector_installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "connector_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
