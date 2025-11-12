-- Table périodes de planification
CREATE TABLE leave_planning_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, -- "Q1 2026", "Année 2026"
  year INTEGER NOT NULL,
  quarter INTEGER, -- NULL = full year, 1-4 = specific quarter
  status TEXT NOT NULL DEFAULT 'draft', -- draft, open, closed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_leave_planning_periods_tenant ON leave_planning_periods(tenant_id);
CREATE INDEX idx_leave_planning_periods_year ON leave_planning_periods(year);

-- Ajouter colonnes à time_off_requests
ALTER TABLE time_off_requests
  ADD COLUMN planning_period_id UUID REFERENCES leave_planning_periods(id),
  ADD COLUMN handover_notes TEXT,
  ADD COLUMN certificate_generated_at TIMESTAMPTZ,
  ADD COLUMN reminder_20d_sent_at TIMESTAMPTZ,
  ADD COLUMN reminder_15d_sent_at TIMESTAMPTZ;

-- Ajouter statut 'planned' (congé planifié mais non approuvé)
ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS valid_status_request;

ALTER TABLE time_off_requests
  ADD CONSTRAINT valid_status_request CHECK (
    status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'planned'::text])
  );

-- Vue pour statistiques couverture d'équipe
CREATE OR REPLACE VIEW leave_team_coverage AS
SELECT
  t.id as tenant_id,
  d.date,
  COUNT(DISTINCT e.id) as total_employees,
  COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.employee_id END) as on_leave_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.employee_id END) / NULLIF(COUNT(DISTINCT e.id), 0), 1) as leave_percentage,
  100.0 - ROUND(100.0 * COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.employee_id END) / NULLIF(COUNT(DISTINCT e.id), 0), 1) as coverage_percentage
FROM tenants t
CROSS JOIN (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '365 days',
    INTERVAL '1 day'
  )::date AS date
) AS d
LEFT JOIN employees e ON e.tenant_id = t.id AND e.status = 'active'
LEFT JOIN time_off_requests r ON
  r.employee_id = e.id
  AND r.status = 'approved'
  AND d.date BETWEEN r.start_date AND r.end_date
GROUP BY t.id, d.date;

-- Index pour performance de la vue
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON time_off_requests(start_date, end_date) WHERE status = 'approved';

-- Table notifications (si elle n'existe pas déjà)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC);

-- Commentaires
COMMENT ON TABLE leave_planning_periods IS 'Périodes de planification des congés annuels (trimestre, année)';
COMMENT ON COLUMN time_off_requests.planning_period_id IS 'Période de planification associée (import Excel massif)';
COMMENT ON COLUMN time_off_requests.handover_notes IS 'Notes de passation de charge avant le départ en congé';
COMMENT ON COLUMN time_off_requests.certificate_generated_at IS 'Date de génération de l''attestation de départ en congé';
