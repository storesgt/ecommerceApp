ALTER TABLE `Refund` ADD COLUMN `orderItemId` VARCHAR(191) NULL,
    ADD COLUMN `quantity` INTEGER NULL;

CREATE INDEX `Refund_orderItemId_status_idx` ON `Refund`(`orderItemId`, `status`);

ALTER TABLE `Refund` ADD CONSTRAINT `Refund_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;