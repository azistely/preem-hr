-- =====================================================
-- Document Generation System
-- =====================================================
-- Purpose: Full document generation with templates, version tracking,
--          access logging, and bulk generation support
-- Use Cases: Pay slips, work certificates, final settlements

-- =====================================================
-- 1. Document Templates
-- =====================================================
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Template identification
    template_type VARCHAR(50) NOT NULL, -- 'bulletin_de_paie', 'certificat_de_travail', 'solde_de_tout_compte'
    template_name VARCHAR(255) NOT NULL,

    -- Template configuration
    template_data JSONB, -- Layout, fonts, logo URL, styling options
    is_default BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one default template per tenant per type
CREATE UNIQUE INDEX idx_document_templates_default
    ON document_templates(tenant_id, template_type)
    WHERE is_default = true;

CREATE INDEX idx_document_templates_tenant ON document_templates(tenant_id);
CREATE INDEX idx_document_templates_type ON document_templates(template_type);

COMMENT ON TABLE document_templates IS 'Customizable document templates for different document types';
COMMENT ON COLUMN document_templates.template_data IS 'JSON configuration for layout, fonts, logo URL, styling';

-- =====================================================
-- 2. Generated Documents
-- =====================================================
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Document identification
    document_type VARCHAR(50) NOT NULL, -- 'bulletin_de_paie', 'certificat_de_travail', 'solde_de_tout_compte'
    document_subtype VARCHAR(50), -- e.g., 'payslip_correction', 'work_certificate_resignation'
    period VARCHAR(7), -- 'YYYY-MM' for payslips

    -- File storage
    file_url TEXT NOT NULL,
    file_size INTEGER,

    -- Version tracking (for corrections)
    generation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version_number INTEGER NOT NULL DEFAULT 1,
    replaces_document_id UUID REFERENCES generated_documents(id), -- Points to previous version
    generated_by UUID REFERENCES users(id),

    -- Metadata (context-specific data)
    metadata JSONB, -- { payrollLineItemId, payrollRunId, terminationDate, reason, etc. }

    -- Access tracking (for analytics and compliance)
    accessed_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_generated_docs_employee ON generated_documents(employee_id, period);
CREATE INDEX idx_generated_docs_type ON generated_documents(tenant_id, document_type, period);
CREATE INDEX idx_generated_docs_tenant ON generated_documents(tenant_id);
CREATE INDEX idx_generated_docs_version ON generated_documents(replaces_document_id) WHERE replaces_document_id IS NOT NULL;

COMMENT ON TABLE generated_documents IS 'All generated documents with version tracking and access analytics';
COMMENT ON COLUMN generated_documents.version_number IS 'Version number for corrections (1 = original, 2+ = corrected)';
COMMENT ON COLUMN generated_documents.replaces_document_id IS 'Link to previous version if this is a correction';
COMMENT ON COLUMN generated_documents.metadata IS 'Context-specific data: payrollLineItemId, terminationDate, reason, etc.';

-- =====================================================
-- 3. Document Access Log
-- =====================================================
CREATE TABLE IF NOT EXISTS document_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL REFERENCES users(id),

    -- Access details
    access_type VARCHAR(50) NOT NULL, -- 'view', 'download', 'email', 'print'
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,

    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_access_log_document ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_user ON document_access_log(accessed_by);
CREATE INDEX idx_document_access_log_date ON document_access_log(accessed_at);

COMMENT ON TABLE document_access_log IS 'Audit trail for document access (GDPR compliance)';
COMMENT ON COLUMN document_access_log.access_type IS 'Type of access: view, download, email, print';

-- =====================================================
-- 4. Bulk Generation Jobs
-- =====================================================
CREATE TABLE IF NOT EXISTS bulk_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,

    -- Job details
    document_type VARCHAR(50) NOT NULL,
    total_documents INTEGER NOT NULL DEFAULT 0,
    generated_documents INTEGER NOT NULL DEFAULT 0,
    failed_documents INTEGER NOT NULL DEFAULT 0,

    -- Status tracking
    job_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'completed_with_errors', 'failed'
    error_log JSONB, -- Array of error objects: [{ lineItemId, employeeNumber, error }]

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bulk_jobs_tenant ON bulk_generation_jobs(tenant_id);
CREATE INDEX idx_bulk_jobs_payroll ON bulk_generation_jobs(payroll_run_id);
CREATE INDEX idx_bulk_jobs_status ON bulk_generation_jobs(job_status);

COMMENT ON TABLE bulk_generation_jobs IS 'Track progress of bulk document generation jobs';
COMMENT ON COLUMN bulk_generation_jobs.job_status IS 'Status: pending, processing, completed, completed_with_errors, failed';
COMMENT ON COLUMN bulk_generation_jobs.error_log IS 'Array of errors: [{ lineItemId, employeeNumber, error }]';

-- =====================================================
-- 5. RLS Policies
-- =====================================================

-- Document Templates: Tenant isolation
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON document_templates
    FOR ALL
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    );

-- Generated Documents: Tenant isolation + Employee access
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON generated_documents
    FOR ALL
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    );

-- Employees can view their own documents
CREATE POLICY employee_access ON generated_documents
    FOR SELECT
    USING (
        employee_id = (auth.jwt() ->> 'employee_id')::uuid
    );

-- Document Access Log: No RLS (audit table)
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all ON document_access_log
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Bulk Generation Jobs: Tenant isolation
ALTER TABLE bulk_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bulk_generation_jobs
    FOR ALL
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    );

-- =====================================================
-- 6. Functions
-- =====================================================

-- Function to update accessed_count when document is accessed
CREATE OR REPLACE FUNCTION increment_document_access_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE generated_documents
    SET
        accessed_count = accessed_count + 1,
        last_accessed_at = NEW.accessed_at
    WHERE id = NEW.document_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment access count
CREATE TRIGGER trigger_increment_document_access_count
    AFTER INSERT ON document_access_log
    FOR EACH ROW
    EXECUTE FUNCTION increment_document_access_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_templates_updated_at
    BEFORE UPDATE ON document_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_document_templates_updated_at();

-- =====================================================
-- 7. Default Templates (Optional Seed Data)
-- =====================================================

-- Create default bulletin de paie template for existing tenants
INSERT INTO document_templates (tenant_id, template_type, template_name, is_default, template_data)
SELECT
    id as tenant_id,
    'bulletin_de_paie' as template_type,
    'Modèle Standard' as template_name,
    true as is_default,
    '{
        "fontSize": 10,
        "fontFamily": "Helvetica",
        "headerHeight": 100,
        "footerHeight": 50,
        "margins": {
            "top": 20,
            "bottom": 20,
            "left": 30,
            "right": 30
        },
        "colors": {
            "primary": "#1e40af",
            "secondary": "#64748b",
            "text": "#000000"
        }
    }'::jsonb as template_data
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.tenant_id = tenants.id
    AND dt.template_type = 'bulletin_de_paie'
);
