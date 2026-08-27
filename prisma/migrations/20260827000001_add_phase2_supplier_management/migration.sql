-- Phase 2: Supplier Management Enhancement
-- Add password rotation, account expiry policies, tagging, and category restrictions

-- Add password tracking to Account
ALTER TABLE accounts ADD COLUMN password_changed_at TIMESTAMP(3);

-- Add supplier account policy fields to Organization
ALTER TABLE organizations ADD COLUMN supplier_password_rotation_days INTEGER;
ALTER TABLE organizations ADD COLUMN supplier_account_expiry_days INTEGER;

-- Create SupplierTag table
CREATE TABLE supplier_tags (
    id TEXT NOT NULL PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT supplier_tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, name)
);

CREATE INDEX supplier_tags_organization_id_idx ON supplier_tags(organization_id);

-- Create SupplierTagAssignment table
CREATE TABLE supplier_tag_assignments (
    id TEXT NOT NULL PRIMARY KEY,
    tag_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT supplier_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES supplier_tags(id) ON DELETE CASCADE,
    CONSTRAINT supplier_tag_assignments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(tag_id, supplier_id)
);

CREATE INDEX supplier_tag_assignments_supplier_id_idx ON supplier_tag_assignments(supplier_id);

-- Create SupplierCategoryAssignment table
CREATE TABLE supplier_category_assignments (
    id TEXT NOT NULL PRIMARY KEY,
    organization_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    category_code TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT supplier_category_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT supplier_category_assignments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(supplier_id, category_code)
);

CREATE INDEX supplier_category_assignments_organization_id_supplier_id_idx ON supplier_category_assignments(organization_id, supplier_id);
