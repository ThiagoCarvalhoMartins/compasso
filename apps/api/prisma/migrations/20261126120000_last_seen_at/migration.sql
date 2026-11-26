-- AlterTable
ALTER TABLE `users` ADD COLUMN `last_seen_at` DATETIME(3) NULL;

-- Ponto de partida: até o próximo acesso, vale o último login.
UPDATE `users` SET `last_seen_at` = `last_login_at`;
