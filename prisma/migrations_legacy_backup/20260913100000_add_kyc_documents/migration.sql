CREATE TABLE `KycDocument` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KycDocument_applicationId_createdAt_idx`(`applicationId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `KycDocument_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `KycApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
