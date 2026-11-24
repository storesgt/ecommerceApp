CREATE TABLE `KycApplication` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `documentType` VARCHAR(80) NOT NULL,
    `documentNumber` VARCHAR(120) NOT NULL,
    `documentUrl` VARCHAR(191) NULL,
    `notes` VARCHAR(1000) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewReason` VARCHAR(1000) NULL,

    UNIQUE INDEX `KycApplication_userId_key`(`userId`),
    INDEX `KycApplication_status_submittedAt_idx`(`status`, `submittedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `KycApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
