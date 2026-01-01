-- Stockvel OS Database Schema - Savings Module
-- PostgreSQL Migration Script
-- Run this to create all tables for the Savings Stokvel module

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- IDENTITY & AUTH
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    id_number VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED')),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE revoked_at IS NULL;

-- ============================================
-- GROUPS & MEMBERSHIP
-- ============================================

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('SAVINGS', 'GROCERY', 'BURIAL', 'ROSCA')),
    description TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    contribution_amount DECIMAL(19, 4),
    contribution_frequency VARCHAR(20) CHECK (contribution_frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY')),
    rules JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DISSOLVED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_groups_type ON groups(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_groups_status ON groups(status) WHERE deleted_at IS NULL;

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'TREASURER', 'SECRETARY', 'CHAIRPERSON')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT')),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, group_id)
);

CREATE INDEX idx_group_members_user_id ON group_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_members_group_id ON group_members(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_members_role ON group_members(role) WHERE deleted_at IS NULL;

-- ============================================
-- SAVINGS-SPECIFIC TABLES
-- ============================================

CREATE TABLE savings_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
    monthly_amount DECIMAL(19, 4) NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 28),
    grace_period_days INTEGER NOT NULL DEFAULT 7,
    fine_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    fine_amount DECIMAL(19, 4),
    fine_type VARCHAR(20) CHECK (fine_type IN ('FLAT', 'PERCENTAGE')),
    payout_model VARCHAR(30) NOT NULL DEFAULT 'YEAR_END' CHECK (payout_model IN ('YEAR_END', 'QUARTERLY', 'ON_DEMAND', 'CUSTOM')),
    payout_schedule JSONB,
    min_approval_count INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_rules_group_id ON savings_rules(group_id);

CREATE TABLE savings_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    amount DECIMAL(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    payout_type VARCHAR(30) NOT NULL CHECK (payout_type IN ('SCHEDULED', 'MANUAL', 'EMERGENCY', 'DISSOLUTION')),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    target_members JSONB, -- Array of member IDs to receive payout
    distribution_type VARCHAR(20) NOT NULL DEFAULT 'EQUAL' CHECK (distribution_type IN ('EQUAL', 'PROPORTIONAL', 'CUSTOM')),
    created_by UUID NOT NULL REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_savings_payouts_group_id ON savings_payouts(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_savings_payouts_status ON savings_payouts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_savings_payouts_created_by ON savings_payouts(created_by);

CREATE TABLE savings_payout_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_id UUID NOT NULL REFERENCES savings_payouts(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(payout_id, approver_id)
);

CREATE INDEX idx_savings_payout_approvals_payout_id ON savings_payout_approvals(payout_id);
CREATE INDEX idx_savings_payout_approvals_approver_id ON savings_payout_approvals(approver_id);

-- ============================================
-- DOCUMENTS
-- ============================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID NOT NULL REFERENCES users(id),
    group_id UUID REFERENCES groups(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('PROOF_OF_PAYMENT', 'DEATH_CERTIFICATE', 'ID_DOCUMENT', 'BANK_STATEMENT', 'CONTRACT', 'OTHER')),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_documents_uploader_id ON documents(uploader_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_group_id ON documents(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_type ON documents(type) WHERE deleted_at IS NULL;

-- ============================================
-- CONTRIBUTIONS & LEDGER
-- ============================================

CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_method VARCHAR(30) CHECK (payment_method IN ('EFT', 'CASH', 'CARD', 'MOBILE_MONEY', 'OTHER')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    pop_document_id UUID REFERENCES documents(id),
    notes TEXT,
    rejection_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contributions_group_id ON contributions(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contributions_member_id ON contributions(member_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contributions_status ON contributions(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contributions_period ON contributions(group_id, period_start, period_end) WHERE deleted_at IS NULL;
-- Prevent duplicate approved contributions for same member + period
CREATE UNIQUE INDEX idx_contributions_unique_approved 
    ON contributions(group_id, member_id, period_start) 
    WHERE status = 'APPROVED' AND deleted_at IS NULL;

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN (
        'CONTRIBUTION_CREDIT',
        'CONTRIBUTION_ADJUSTMENT',
        'PAYOUT_DEBIT',
        'PAYOUT_ADJUSTMENT',
        'FINE_CREDIT',
        'INTEREST_CREDIT',
        'FEE_DEBIT',
        'OPENING_BALANCE',
        'CORRECTION'
    )),
    amount DECIMAL(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    balance_after DECIMAL(19, 4) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    -- NO deleted_at - ledger entries are IMMUTABLE
);

CREATE INDEX idx_ledger_entries_group_id ON ledger_entries(group_id);
CREATE INDEX idx_ledger_entries_entry_type ON ledger_entries(entry_type);
CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries(reference_type, reference_id);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM', 'API_KEY', 'WEBHOOK')),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    group_id UUID REFERENCES groups(id),
    before_state JSONB,
    after_state JSONB,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'PARTIAL')),
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    -- NO deleted_at - audit logs are IMMUTABLE
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_group_id ON audit_logs(group_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- IDEMPOTENCY STORE
-- ============================================

CREATE TABLE idempotency_keys (
    key VARCHAR(100) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- ============================================
-- NOTIFICATIONS (for background jobs)
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ')),
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_members_updated_at BEFORE UPDATE ON group_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_savings_rules_updated_at BEFORE UPDATE ON savings_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_savings_payouts_updated_at BEFORE UPDATE ON savings_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contributions_updated_at BEFORE UPDATE ON contributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate pot balance for a group
CREATE OR REPLACE FUNCTION get_pot_balance(p_group_id UUID)
RETURNS DECIMAL(19, 4) AS $$
DECLARE
    v_balance DECIMAL(19, 4);
BEGIN
    SELECT COALESCE(balance_after, 0)
    INTO v_balance
    FROM ledger_entries
    WHERE group_id = p_group_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DATA FOR TESTING (Optional)
-- ============================================

-- Uncomment below for development seed data
/*
INSERT INTO users (id, email, phone, password_hash, first_name, last_name, email_verified, phone_verified)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin@stockvel.co.za', '+27821234567', '$2b$10$...hash...', 'Admin', 'User', true, true),
    ('22222222-2222-2222-2222-222222222222', 'treasurer@stockvel.co.za', '+27829876543', '$2b$10$...hash...', 'Treasury', 'Manager', true, true),
    ('33333333-3333-3333-3333-333333333333', 'member@stockvel.co.za', '+27825555555', '$2b$10$...hash...', 'Regular', 'Member', true, true);

INSERT INTO groups (id, name, type, description, currency, contribution_amount, contribution_frequency, status)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Family Savings Club', 'SAVINGS', 'Monthly family savings group', 'ZAR', 500.00, 'MONTHLY', 'ACTIVE');

INSERT INTO group_members (user_id, group_id, role, status)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CHAIRPERSON', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TREASURER', 'ACTIVE'),
    ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MEMBER', 'ACTIVE');

INSERT INTO savings_rules (group_id, monthly_amount, due_day, grace_period_days, fine_enabled, fine_amount, fine_type, payout_model)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 500.00, 1, 7, true, 50.00, 'FLAT', 'YEAR_END');

INSERT INTO ledger_entries (group_id, entry_type, amount, currency, balance_after, description)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OPENING_BALANCE', 0, 'ZAR', 0, 'Opening balance for new group');
*/
