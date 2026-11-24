ALTER TABLE `User` MODIFY `role` ENUM('CUSTOMER', 'ADMIN', 'STAFF', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF') NOT NULL DEFAULT 'CUSTOMER';

CREATE TABLE `UserPermission` (
	`id` VARCHAR(191) NOT NULL,
	`userId` VARCHAR(191) NOT NULL,
	`permission` VARCHAR(191) NOT NULL,
	`granted` BOOLEAN NOT NULL DEFAULT true,
	`createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` DATETIME(3) NOT NULL,

	UNIQUE INDEX `UserPermission_userId_permission_key`(`userId`, `permission`),
	INDEX `UserPermission_permission_granted_idx`(`permission`, `granted`),
	PRIMARY KEY (`id`),
	CONSTRAINT `UserPermission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
