CREATE TABLE `DeliveryNegotiation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `country` VARCHAR(80) NOT NULL,
    `requestedMethod` VARCHAR(100) NOT NULL,
    `weightKg` DECIMAL(8, 3) NOT NULL DEFAULT 0,
    `note` VARCHAR(500) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DECLINED', 'USED') NOT NULL DEFAULT 'PENDING',
    `approvedShippingMethodId` VARCHAR(191) NULL,
    `responseNote` VARCHAR(1000) NULL,
    `orderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeliveryNegotiation_orderId_key` (`orderId`),
    INDEX `DeliveryNegotiation_userId_status_createdAt_idx` (`userId`, `status`, `createdAt`),
    INDEX `DeliveryNegotiation_status_createdAt_idx` (`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeliveryNegotiation`
    ADD CONSTRAINT `DeliveryNegotiation_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `DeliveryNegotiation_approvedShippingMethodId_fkey`
    FOREIGN KEY (`approvedShippingMethodId`) REFERENCES `ShippingMethod`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `DeliveryNegotiation_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
