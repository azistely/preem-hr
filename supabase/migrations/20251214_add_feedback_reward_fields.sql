-- Add reward recommendation and approval fields to continuous_feedback table
-- This enables the Recognition → Rewards workflow

-- Add reward recommendation fields (for recognition type feedback)
ALTER TABLE continuous_feedback
ADD COLUMN IF NOT EXISTS recommends_bonus_amount NUMERIC,
ADD COLUMN IF NOT EXISTS recommends_bonus_reason TEXT,
ADD COLUMN IF NOT EXISTS recommends_promotion BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recommends_promotion_to TEXT;

-- Add reward approval workflow fields
ALTER TABLE continuous_feedback
ADD COLUMN IF NOT EXISTS reward_status TEXT,
ADD COLUMN IF NOT EXISTS reward_approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reward_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reward_rejection_reason TEXT;

-- Add link to bonus if approved
ALTER TABLE continuous_feedback
ADD COLUMN IF NOT EXISTS linked_bonus_id UUID;

-- Add updated_at for tracking changes
ALTER TABLE continuous_feedback
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Add index for efficient reward status queries
CREATE INDEX IF NOT EXISTS idx_continuous_feedback_reward_status
ON continuous_feedback(tenant_id, reward_status)
WHERE reward_status IS NOT NULL;

-- Add index for pending approvals
CREATE INDEX IF NOT EXISTS idx_continuous_feedback_pending_rewards
ON continuous_feedback(tenant_id, created_at)
WHERE reward_status = 'pending_approval';

-- Add constraint to ensure bonus amount is positive
ALTER TABLE continuous_feedback
ADD CONSTRAINT chk_positive_bonus_amount
CHECK (recommends_bonus_amount IS NULL OR recommends_bonus_amount > 0);

-- Add check constraint for valid reward status values
ALTER TABLE continuous_feedback
ADD CONSTRAINT chk_valid_reward_status
CHECK (reward_status IS NULL OR reward_status IN ('pending_approval', 'approved', 'rejected'));

COMMENT ON COLUMN continuous_feedback.recommends_bonus_amount IS 'Suggested bonus amount for recognition';
COMMENT ON COLUMN continuous_feedback.recommends_bonus_reason IS 'Justification for the bonus recommendation';
COMMENT ON COLUMN continuous_feedback.recommends_promotion IS 'Whether this recognition suggests a promotion';
COMMENT ON COLUMN continuous_feedback.recommends_promotion_to IS 'Target position/level for promotion';
COMMENT ON COLUMN continuous_feedback.reward_status IS 'null=no reward, pending_approval, approved, rejected';
COMMENT ON COLUMN continuous_feedback.reward_approved_by IS 'HR user who approved/rejected the reward';
COMMENT ON COLUMN continuous_feedback.reward_approved_at IS 'When the reward decision was made';
COMMENT ON COLUMN continuous_feedback.linked_bonus_id IS 'References bonuses table if bonus was created';
