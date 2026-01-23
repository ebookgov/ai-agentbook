-- Create subscriptions table for PayPal integration
CREATE TABLE IF NOT EXISTS public.subscriptions (
    subscription_id TEXT PRIMARY KEY,
    user_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    plan_id TEXT,
    start_time TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON public.subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role (webhook server uses service role key)
DROP POLICY IF EXISTS "Enable all for service role" ON public.subscriptions;
CREATE POLICY "Enable all for service role" ON public.subscriptions FOR ALL USING (true);

-- Add table comment
COMMENT ON TABLE public.subscriptions IS 'Tracks PayPal subscriptions for AI Agent access';
