-- AlterTable
ALTER TABLE `block_logs` ADD COLUMN `via_minimum` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `blocks` ADD COLUMN `minimum_version` VARCHAR(120) NULL;
