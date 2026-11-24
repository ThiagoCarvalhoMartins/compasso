-- AlterTable
ALTER TABLE `blocks` ADD COLUMN `micro_habit_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `micro_habits` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `identity` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `micro_habits_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_micro_habit_id_fkey` FOREIGN KEY (`micro_habit_id`) REFERENCES `micro_habits`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `micro_habits` ADD CONSTRAINT `micro_habits_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
