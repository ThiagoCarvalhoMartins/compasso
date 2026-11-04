-- AlterTable
ALTER TABLE `blocks` ADD COLUMN `ends_on` DATE NULL,
    ADD COLUMN `excluded_dates` TEXT NULL;
