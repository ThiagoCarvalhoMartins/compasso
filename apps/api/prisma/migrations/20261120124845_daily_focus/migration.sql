-- CreateTable
CREATE TABLE `daily_focus` (
    `user_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `answer` VARCHAR(200) NULL,
    `block_id` VARCHAR(191) NULL,
    `skipped` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_focus_block_id_idx`(`block_id`),
    PRIMARY KEY (`user_id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_focus` ADD CONSTRAINT `daily_focus_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_focus` ADD CONSTRAINT `daily_focus_block_id_fkey` FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
